package graphql

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/alerts"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/model"
	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// subscribeInstance bridges an alerts.EventBus into a GraphQL subscription
// channel, filtering to a single EventKind. Shared by AlertFired and
// AlertResolved resolvers.
func subscribeInstance(ctx context.Context, engine *alerts.Engine, want alerts.EventKind, metric string) (<-chan *model.AlertInstance, error) {
	if engine == nil {
		return nil, fmt.Errorf("alert engine not configured")
	}
	listener := engine.Bus().Subscribe()
	ch := make(chan *model.AlertInstance, 1)

	observability.ActiveSubscriptions.WithLabelValues(metric).Inc()
	go func() {
		defer observability.ActiveSubscriptions.WithLabelValues(metric).Dec()
		defer close(ch)
		defer listener.Close()

		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-listener.Updates():
				if !ok {
					return
				}
				if evt.Kind != want {
					continue
				}
				select {
				case ch <- dbInstanceToModel(evt.Instance):
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return ch, nil
}

func formatTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

func formatTimePtr(t *time.Time) *string {
	if t == nil || t.IsZero() {
		return nil
	}
	s := t.UTC().Format(time.RFC3339)
	return &s
}

func parseTimePtr(s *string) (*time.Time, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, *s)
	if err != nil {
		return nil, fmt.Errorf("parse time %q: %w", *s, err)
	}
	return &t, nil
}

func parseInt64ID(id string) (int64, error) {
	n, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid id %q: %w", id, err)
	}
	return n, nil
}

func dbRuleToModel(r storage.DBAlertRule) (*model.AlertRule, error) {
	var cond storage.AlertConditionPayload
	if err := json.Unmarshal(r.Condition, &cond); err != nil {
		return nil, fmt.Errorf("decode condition for rule %d: %w", r.ID, err)
	}
	mc := &model.AlertCondition{
		Type:      model.AlertConditionType(cond.Type),
		Threshold: cond.Threshold,
	}
	if cond.WindowSec > 0 {
		w := cond.WindowSec
		mc.WindowSec = &w
	}
	return &model.AlertRule{
		ID:          strconv.FormatInt(r.ID, 10),
		Name:        r.Name,
		Description: r.Description,
		Condition:   mc,
		Severity:    model.AlertSeverity(r.Severity),
		Owner:       r.Owner,
		IsPreset:    r.IsPreset,
		Enabled:     r.Enabled,
		CreatedAt:   formatTime(r.CreatedAt),
		UpdatedAt:   formatTime(r.UpdatedAt),
	}, nil
}

func dbInstanceToModel(i storage.DBAlertInstance) *model.AlertInstance {
	out := &model.AlertInstance{
		ID:         strconv.FormatInt(i.ID, 10),
		RuleID:     strconv.FormatInt(i.RuleID, 10),
		State:      model.AlertState(i.State),
		DedupKey:   i.DedupKey,
		FiredAt:    formatTime(i.FiredAt),
		LastSeenAt: formatTime(i.LastSeenAt),
		ResolvedAt: formatTimePtr(i.ResolvedAt),
		Message:    i.Message,
	}
	if i.CurrentValue != nil {
		v := *i.CurrentValue
		out.CurrentValue = &v
	}
	if len(i.Context) > 0 {
		out.ContextJSON = string(i.Context)
	} else {
		out.ContextJSON = "{}"
	}
	return out
}

func conditionInputToJSON(in model.AlertConditionInput) (json.RawMessage, error) {
	t := string(in.Type)
	if !storage.IsValidAlertConditionType(t) {
		return nil, fmt.Errorf("unknown condition type: %s", t)
	}
	p := storage.AlertConditionPayload{Type: t, Threshold: in.Threshold}
	if in.WindowSec != nil {
		p.WindowSec = *in.WindowSec
	}
	return json.Marshal(p)
}
