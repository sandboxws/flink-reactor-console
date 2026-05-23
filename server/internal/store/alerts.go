package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// AlertStore provides CRUD operations for alert rules, instances, and acks.
type AlertStore struct {
	pool *pgxpool.Pool
}

// ErrAlertRuleNotFound is returned when a lookup by ID has no match.
var ErrAlertRuleNotFound = errors.New("alert rule not found")

// ErrAlertInstanceNotFound is returned when a lookup by ID has no match.
var ErrAlertInstanceNotFound = errors.New("alert instance not found")

// ErrInvalidStateTransition is returned for state-machine violations.
var ErrInvalidStateTransition = errors.New("invalid alert state transition")

// AlertRuleInput captures the fields required to create or update a rule.
type AlertRuleInput struct {
	Name        string
	Description string
	Condition   json.RawMessage
	Severity    string
	Owner       string
	Enabled     bool
	IsPreset    bool
}

// AlertHistoryFilter narrows alertHistory queries.
type AlertHistoryFilter struct {
	RuleID *int64
	State  *string
	After  *time.Time
	Before *time.Time
	Limit  int
	Offset int
}

// -- Rule CRUD -------------------------------------------------------------

// CreateRule inserts a new alert rule and returns it with generated columns populated.
func (s *AlertStore) CreateRule(ctx context.Context, in AlertRuleInput) (*storage.DBAlertRule, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO alert_rules (name, description, condition, severity, owner, is_preset, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, name, description, condition, severity, owner, is_preset, enabled, created_at, updated_at
	`, in.Name, in.Description, in.Condition, in.Severity, in.Owner, in.IsPreset, in.Enabled)

	r := &storage.DBAlertRule{}
	if err := row.Scan(&r.ID, &r.Name, &r.Description, &r.Condition, &r.Severity, &r.Owner, &r.IsPreset, &r.Enabled, &r.CreatedAt, &r.UpdatedAt); err != nil {
		return nil, fmt.Errorf("insert alert rule: %w", err)
	}
	return r, nil
}

// UpdateRule applies changes to an existing rule. Any nil field is left unchanged.
func (s *AlertStore) UpdateRule(ctx context.Context, id int64, in AlertRuleInput) (*storage.DBAlertRule, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE alert_rules SET
			name        = $2,
			description = $3,
			condition   = $4,
			severity    = $5,
			owner       = $6,
			enabled     = $7,
			updated_at  = now()
		WHERE id = $1
		RETURNING id, name, description, condition, severity, owner, is_preset, enabled, created_at, updated_at
	`, id, in.Name, in.Description, in.Condition, in.Severity, in.Owner, in.Enabled)

	r := &storage.DBAlertRule{}
	err := row.Scan(&r.ID, &r.Name, &r.Description, &r.Condition, &r.Severity, &r.Owner, &r.IsPreset, &r.Enabled, &r.CreatedAt, &r.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAlertRuleNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("update alert rule %d: %w", id, err)
	}
	return r, nil
}

// SetRuleEnabled toggles only the enabled flag.
func (s *AlertStore) SetRuleEnabled(ctx context.Context, id int64, enabled bool) error {
	tag, err := s.pool.Exec(ctx, `UPDATE alert_rules SET enabled = $2, updated_at = now() WHERE id = $1`, id, enabled)
	if err != nil {
		return fmt.Errorf("toggle rule %d: %w", id, err)
	}
	if tag.RowsAffected() == 0 {
		return ErrAlertRuleNotFound
	}
	return nil
}

// DeleteRule removes a rule. Cascades remove any associated instances.
func (s *AlertStore) DeleteRule(ctx context.Context, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM alert_rules WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete rule %d: %w", id, err)
	}
	if tag.RowsAffected() == 0 {
		return ErrAlertRuleNotFound
	}
	return nil
}

// GetRule returns one rule by id.
func (s *AlertStore) GetRule(ctx context.Context, id int64) (*storage.DBAlertRule, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, name, description, condition, severity, owner, is_preset, enabled, created_at, updated_at
		FROM alert_rules WHERE id = $1
	`, id)
	r := &storage.DBAlertRule{}
	err := row.Scan(&r.ID, &r.Name, &r.Description, &r.Condition, &r.Severity, &r.Owner, &r.IsPreset, &r.Enabled, &r.CreatedAt, &r.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAlertRuleNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get rule %d: %w", id, err)
	}
	return r, nil
}

// ListRules returns all rules ordered by created_at descending.
// If enabledOnly is true, returns only enabled rules.
func (s *AlertStore) ListRules(ctx context.Context, enabledOnly bool) ([]storage.DBAlertRule, error) {
	q := `
		SELECT id, name, description, condition, severity, owner, is_preset, enabled, created_at, updated_at
		FROM alert_rules
	`
	if enabledOnly {
		q += ` WHERE enabled = true`
	}
	q += ` ORDER BY created_at DESC`

	rows, err := s.pool.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list rules: %w", err)
	}
	defer rows.Close()

	var out []storage.DBAlertRule
	for rows.Next() {
		var r storage.DBAlertRule
		if err := rows.Scan(&r.ID, &r.Name, &r.Description, &r.Condition, &r.Severity, &r.Owner, &r.IsPreset, &r.Enabled, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan rule: %w", err)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// -- Instance lifecycle ----------------------------------------------------

// OpenInstance fires (or refreshes) an instance for the given (rule_id, dedup_key).
// If an open instance exists, last_seen_at + context + current_value + message are
// updated. Otherwise a new FIRING instance is inserted. Returns the instance and
// a flag indicating whether it was newly created.
func (s *AlertStore) OpenInstance(
	ctx context.Context,
	ruleID int64,
	dedupKey string,
	contextJSON json.RawMessage,
	currentValue *float64,
	message string,
) (*storage.DBAlertInstance, bool, error) {
	// Try update on an existing open instance first.
	row := s.pool.QueryRow(ctx, `
		UPDATE alert_instances
		SET last_seen_at = now(),
			context = $3,
			current_value = $4,
			message = $5
		WHERE rule_id = $1 AND dedup_key = $2 AND state IN ('FIRING', 'ACKNOWLEDGED')
		RETURNING id, rule_id, state, dedup_key, fired_at, last_seen_at, resolved_at, context, current_value, message
	`, ruleID, dedupKey, contextJSON, currentValue, message)

	inst := &storage.DBAlertInstance{}
	err := row.Scan(&inst.ID, &inst.RuleID, &inst.State, &inst.DedupKey, &inst.FiredAt, &inst.LastSeenAt, &inst.ResolvedAt, &inst.Context, &inst.CurrentValue, &inst.Message)
	if err == nil {
		return inst, false, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, fmt.Errorf("refresh open instance: %w", err)
	}

	// No open instance — insert a new FIRING row.
	row = s.pool.QueryRow(ctx, `
		INSERT INTO alert_instances (rule_id, state, dedup_key, context, current_value, message)
		VALUES ($1, 'FIRING', $2, $3, $4, $5)
		RETURNING id, rule_id, state, dedup_key, fired_at, last_seen_at, resolved_at, context, current_value, message
	`, ruleID, dedupKey, contextJSON, currentValue, message)

	inst = &storage.DBAlertInstance{}
	if err := row.Scan(&inst.ID, &inst.RuleID, &inst.State, &inst.DedupKey, &inst.FiredAt, &inst.LastSeenAt, &inst.ResolvedAt, &inst.Context, &inst.CurrentValue, &inst.Message); err != nil {
		return nil, false, fmt.Errorf("insert new instance: %w", err)
	}
	return inst, true, nil
}

// TransitionInstance updates the state of an instance, enforcing the state machine.
// Valid transitions (from → to):
//
//	FIRING       → ACKNOWLEDGED, SILENCED, RESOLVED
//	ACKNOWLEDGED → RESOLVED
//	SILENCED     → RESOLVED
//
// Returns ErrInvalidStateTransition if the transition is not allowed.
func (s *AlertStore) TransitionInstance(ctx context.Context, id int64, toState string) (*storage.DBAlertInstance, error) {
	if !isValidNextState(toState) {
		return nil, ErrInvalidStateTransition
	}

	// Read current state, enforce the allowed transitions.
	current, err := s.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	if !allowedTransition(current.State, toState) {
		return nil, fmt.Errorf("%w: %s → %s", ErrInvalidStateTransition, current.State, toState)
	}

	// Apply state. RESOLVED also sets resolved_at.
	var row pgx.Row
	if toState == storage.AlertStateResolved {
		row = s.pool.QueryRow(ctx, `
			UPDATE alert_instances SET state = $2, resolved_at = now()
			WHERE id = $1
			RETURNING id, rule_id, state, dedup_key, fired_at, last_seen_at, resolved_at, context, current_value, message
		`, id, toState)
	} else {
		row = s.pool.QueryRow(ctx, `
			UPDATE alert_instances SET state = $2
			WHERE id = $1
			RETURNING id, rule_id, state, dedup_key, fired_at, last_seen_at, resolved_at, context, current_value, message
		`, id, toState)
	}

	out := &storage.DBAlertInstance{}
	if err := row.Scan(&out.ID, &out.RuleID, &out.State, &out.DedupKey, &out.FiredAt, &out.LastSeenAt, &out.ResolvedAt, &out.Context, &out.CurrentValue, &out.Message); err != nil {
		return nil, fmt.Errorf("apply transition: %w", err)
	}
	return out, nil
}

func isValidNextState(s string) bool {
	switch s {
	case storage.AlertStateAcknowledged, storage.AlertStateSilenced, storage.AlertStateResolved:
		return true
	}
	return false
}

func allowedTransition(from, to string) bool {
	switch from {
	case storage.AlertStateFiring:
		return to == storage.AlertStateAcknowledged || to == storage.AlertStateSilenced || to == storage.AlertStateResolved
	case storage.AlertStateAcknowledged:
		return to == storage.AlertStateResolved
	case storage.AlertStateSilenced:
		return to == storage.AlertStateResolved
	}
	return false
}

// GetInstance returns one instance by id.
func (s *AlertStore) GetInstance(ctx context.Context, id int64) (*storage.DBAlertInstance, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, rule_id, state, dedup_key, fired_at, last_seen_at, resolved_at, context, current_value, message
		FROM alert_instances WHERE id = $1
	`, id)
	inst := &storage.DBAlertInstance{}
	err := row.Scan(&inst.ID, &inst.RuleID, &inst.State, &inst.DedupKey, &inst.FiredAt, &inst.LastSeenAt, &inst.ResolvedAt, &inst.Context, &inst.CurrentValue, &inst.Message)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAlertInstanceNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get instance %d: %w", id, err)
	}
	return inst, nil
}

// ListActiveInstances returns all instances whose state is FIRING or ACKNOWLEDGED.
func (s *AlertStore) ListActiveInstances(ctx context.Context) ([]storage.DBAlertInstance, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, rule_id, state, dedup_key, fired_at, last_seen_at, resolved_at, context, current_value, message
		FROM alert_instances
		WHERE state IN ('FIRING', 'ACKNOWLEDGED')
		ORDER BY fired_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("list active: %w", err)
	}
	defer rows.Close()

	var out []storage.DBAlertInstance
	for rows.Next() {
		var i storage.DBAlertInstance
		if err := rows.Scan(&i.ID, &i.RuleID, &i.State, &i.DedupKey, &i.FiredAt, &i.LastSeenAt, &i.ResolvedAt, &i.Context, &i.CurrentValue, &i.Message); err != nil {
			return nil, fmt.Errorf("scan instance: %w", err)
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

// ListStaleOpenInstances returns instances that are FIRING or ACKNOWLEDGED and
// whose last_seen_at is older than the cutoff. Used by the auto-resolve loop.
func (s *AlertStore) ListStaleOpenInstances(ctx context.Context, olderThan time.Time) ([]storage.DBAlertInstance, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, rule_id, state, dedup_key, fired_at, last_seen_at, resolved_at, context, current_value, message
		FROM alert_instances
		WHERE state IN ('FIRING', 'ACKNOWLEDGED') AND last_seen_at < $1
	`, olderThan)
	if err != nil {
		return nil, fmt.Errorf("list stale: %w", err)
	}
	defer rows.Close()

	var out []storage.DBAlertInstance
	for rows.Next() {
		var i storage.DBAlertInstance
		if err := rows.Scan(&i.ID, &i.RuleID, &i.State, &i.DedupKey, &i.FiredAt, &i.LastSeenAt, &i.ResolvedAt, &i.Context, &i.CurrentValue, &i.Message); err != nil {
			return nil, fmt.Errorf("scan stale: %w", err)
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

// QueryHistory returns instances matching the filter, ordered by fired_at DESC.
func (s *AlertStore) QueryHistory(ctx context.Context, f AlertHistoryFilter) ([]storage.DBAlertInstance, error) {
	q := `
		SELECT id, rule_id, state, dedup_key, fired_at, last_seen_at, resolved_at, context, current_value, message
		FROM alert_instances WHERE 1=1
	`
	args := []any{}
	idx := 1
	if f.RuleID != nil {
		q += fmt.Sprintf(" AND rule_id = $%d", idx)
		args = append(args, *f.RuleID)
		idx++
	}
	if f.State != nil {
		q += fmt.Sprintf(" AND state = $%d", idx)
		args = append(args, *f.State)
		idx++
	}
	if f.After != nil {
		q += fmt.Sprintf(" AND fired_at >= $%d", idx)
		args = append(args, *f.After)
		idx++
	}
	if f.Before != nil {
		q += fmt.Sprintf(" AND fired_at <= $%d", idx)
		args = append(args, *f.Before)
		idx++
	}
	q += " ORDER BY fired_at DESC"
	if f.Limit > 0 {
		q += fmt.Sprintf(" LIMIT $%d", idx)
		args = append(args, f.Limit)
		idx++
	}
	if f.Offset > 0 {
		q += fmt.Sprintf(" OFFSET $%d", idx)
		args = append(args, f.Offset)
	}

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("query history: %w", err)
	}
	defer rows.Close()

	var out []storage.DBAlertInstance
	for rows.Next() {
		var i storage.DBAlertInstance
		if err := rows.Scan(&i.ID, &i.RuleID, &i.State, &i.DedupKey, &i.FiredAt, &i.LastSeenAt, &i.ResolvedAt, &i.Context, &i.CurrentValue, &i.Message); err != nil {
			return nil, fmt.Errorf("scan history: %w", err)
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

// CreateAck records an acknowledgement row. Caller is expected to have
// transitioned the instance to ACKNOWLEDGED separately.
func (s *AlertStore) CreateAck(ctx context.Context, instanceID int64, ackBy, note string) (*storage.DBAlertAck, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO alert_acknowledgements (instance_id, ack_by, note)
		VALUES ($1, $2, $3)
		RETURNING id, instance_id, ack_by, ack_at, note
	`, instanceID, ackBy, note)

	a := &storage.DBAlertAck{}
	if err := row.Scan(&a.ID, &a.InstanceID, &a.AckBy, &a.AckAt, &a.Note); err != nil {
		return nil, fmt.Errorf("create ack: %w", err)
	}
	return a, nil
}

// ResolveByRule auto-resolves all open instances for a rule (used when a rule is deleted).
func (s *AlertStore) ResolveByRule(ctx context.Context, ruleID int64) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE alert_instances
		SET state = 'RESOLVED', resolved_at = now()
		WHERE rule_id = $1 AND state IN ('FIRING', 'ACKNOWLEDGED')
	`, ruleID)
	if err != nil {
		return fmt.Errorf("resolve by rule %d: %w", ruleID, err)
	}
	return nil
}
