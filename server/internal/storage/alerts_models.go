package storage

import (
	"encoding/json"
	"time"
)

// Alert condition type constants. The set of accepted condition `type` values is
// a fixed enum chosen to match parity with the legacy client-side alerts engine.
const (
	AlertConditionSlotExhaustion        = "SLOT_EXHAUSTION"
	AlertConditionBackpressure          = "BACKPRESSURE"
	AlertConditionCheckpointFailure     = "CHECKPOINT_FAILURE"
	AlertConditionTMMemory              = "TM_MEMORY"
	AlertConditionTMLost                = "TM_LOST"
	AlertConditionProcessMemoryHeadroom = "PROCESS_MEMORY_HEADROOM"
	AlertConditionGCPressure            = "GC_PRESSURE"
)

// AlertSeverity values.
const (
	AlertSeverityInfo     = "info"
	AlertSeverityWarning  = "warning"
	AlertSeverityCritical = "critical"
)

// AlertState values.
const (
	AlertStateFiring       = "FIRING"
	AlertStateAcknowledged = "ACKNOWLEDGED"
	AlertStateSilenced     = "SILENCED"
	AlertStateResolved     = "RESOLVED"
)

// AlertConditionPayload is the structured JSON stored in alert_rules.condition.
// `Type` is one of the AlertCondition* constants; remaining fields are optional
// per-type configuration.
type AlertConditionPayload struct {
	Type      string  `json:"type"`
	Threshold float64 `json:"threshold"`
	WindowSec int     `json:"windowSec,omitempty"`
}

// IsValidAlertConditionType returns true if t is one of the accepted enum values.
func IsValidAlertConditionType(t string) bool {
	switch t {
	case AlertConditionSlotExhaustion,
		AlertConditionBackpressure,
		AlertConditionCheckpointFailure,
		AlertConditionTMMemory,
		AlertConditionTMLost,
		AlertConditionProcessMemoryHeadroom,
		AlertConditionGCPressure:
		return true
	}
	return false
}

// IsValidAlertSeverity returns true if s is one of the accepted severity values.
func IsValidAlertSeverity(s string) bool {
	switch s {
	case AlertSeverityInfo, AlertSeverityWarning, AlertSeverityCritical:
		return true
	}
	return false
}

// DBAlertRule mirrors the alert_rules table.
type DBAlertRule struct {
	ID          int64           `db:"id"`
	Name        string          `db:"name"`
	Description string          `db:"description"`
	Condition   json.RawMessage `db:"condition"`
	Severity    string          `db:"severity"`
	Owner       string          `db:"owner"`
	IsPreset    bool            `db:"is_preset"`
	Enabled     bool            `db:"enabled"`
	CreatedAt   time.Time       `db:"created_at"`
	UpdatedAt   time.Time       `db:"updated_at"`
}

// DBAlertInstance mirrors the alert_instances table.
type DBAlertInstance struct {
	ID           int64           `db:"id"`
	RuleID       int64           `db:"rule_id"`
	State        string          `db:"state"`
	DedupKey     string          `db:"dedup_key"`
	FiredAt      time.Time       `db:"fired_at"`
	LastSeenAt   time.Time       `db:"last_seen_at"`
	ResolvedAt   *time.Time      `db:"resolved_at"`
	Context      json.RawMessage `db:"context"`
	CurrentValue *float64        `db:"current_value"`
	Message      string          `db:"message"`
}

// DBAlertAck mirrors the alert_acknowledgements table.
type DBAlertAck struct {
	ID         int64     `db:"id"`
	InstanceID int64     `db:"instance_id"`
	AckBy      string    `db:"ack_by"`
	AckAt      time.Time `db:"ack_at"`
	Note       string    `db:"note"`
}
