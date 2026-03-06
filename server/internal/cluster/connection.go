// Package cluster provides multi-cluster connection management for Flink.
package cluster

import (
	"sync"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

// Connection holds all per-cluster resources: Flink client stack, optional SQL
// Gateway client, and health metadata. Status fields are protected by mu.
type Connection struct {
	Name    string
	URL     string
	Service *flink.Service
	Poller  *flink.Poller

	// SQLClient is the Flink Client configured for SQL Gateway (nil if not configured).
	SQLClient *flink.Client

	mu            sync.Mutex
	status        Status
	lastCheckTime time.Time
	version       string
}

// Status returns the current health status (thread-safe).
func (c *Connection) Status() Status {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.status
}

// LastCheckTime returns the last health check timestamp (thread-safe).
func (c *Connection) LastCheckTime() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.lastCheckTime
}

// Version returns the Flink version string from the last successful health check.
func (c *Connection) Version() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.version
}

// setHealthy updates the connection to healthy status with version and timestamp.
func (c *Connection) setHealthy(version string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.status = StatusHealthy
	c.version = version
	c.lastCheckTime = time.Now()
}

// setUnhealthy updates the connection to unhealthy status with timestamp.
func (c *Connection) setUnhealthy() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.status = StatusUnhealthy
	c.lastCheckTime = time.Now()
}
