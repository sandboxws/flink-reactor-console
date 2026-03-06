package cluster

import "time"

// Status represents the health state of a cluster connection.
type Status string

// Health status values for cluster connections.
const (
	StatusHealthy   Status = "HEALTHY"
	StatusUnhealthy Status = "UNHEALTHY"
	StatusUnknown   Status = "UNKNOWN"
)

// Info provides a read-only snapshot of a cluster's state for the
// GraphQL clusters query.
type Info struct {
	Name          string     `json:"name"`
	URL           string     `json:"url"`
	Status        Status     `json:"status"`
	LastCheckTime *time.Time `json:"lastCheckTime,omitempty"`
	Version       *string    `json:"version,omitempty"`
}
