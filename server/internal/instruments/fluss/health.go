package fluss

import "fmt"

// HealthCategory is the granular bucket a HealthError falls into. The dashboard
// renders a different indicator per category (red ZK icon vs red coordinator
// icon vs red tablet-server icon), so callers should switch on Category()
// instead of inspecting the underlying error string.
type HealthCategory string

// Health categories returned by HealthCheck. Each maps to a distinct dashboard
// indicator. New categories should be added here, not invented at call sites.
const (
	HealthZKUnreachable           HealthCategory = "zk-unreachable"
	HealthCoordinatorUnresponsive HealthCategory = "coordinator-unresponsive"
	HealthNoTabletServers         HealthCategory = "no-tablet-servers"
)

// HealthError is the typed error returned by HealthCheck. Callers can use
// errors.As to recover the category for granular UI rendering.
type HealthError struct {
	Cat HealthCategory
	Err error
}

// Error implements the error interface with a category prefix so logs surface
// the category even when the caller doesn't unwrap the typed error.
func (e *HealthError) Error() string {
	if e.Err == nil {
		return string(e.Cat)
	}
	return fmt.Sprintf("%s: %s", e.Cat, e.Err.Error())
}

// Unwrap exposes the underlying error for errors.Is/As chains.
func (e *HealthError) Unwrap() error { return e.Err }

// Category returns the granular health category. Returns "" for nil receivers.
func (e *HealthError) Category() HealthCategory {
	if e == nil {
		return ""
	}
	return e.Cat
}
