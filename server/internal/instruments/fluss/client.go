// Package fluss implements the Fluss instrument for browsing Apache Fluss
// databases, tables, and TabletServer health from the dashboard.
//
// Fluss does not (yet) ship a Go-native admin client, so the instrument
// communicates with the cluster over HTTP/JSON against an admin sidecar
// endpoint. The Client type is intentionally narrow — it only models what
// the GraphQL resolvers need — and has a swap-in friendly shape so a future
// native RPC client can replace the HTTP transport without touching the
// resolver layer.
package fluss

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Default timeouts. The 5s health-check ceiling is mandated by the spec —
// individual probes share the same overall budget.
const (
	clientHTTPTimeout = 15 * time.Second
	healthTimeout     = 5 * time.Second
	zkDialTimeout     = 2 * time.Second
)

// Client is a thin admin client for a Fluss cluster. It is safe for
// concurrent use across goroutines.
type Client struct {
	baseURL    string
	httpClient *http.Client

	saslEnabled  bool
	saslMech     string
	saslUser     string
	saslPassword string

	zkEnsemble string
}

// NewClient constructs a Client from a validated Config.
func NewClient(cfg Config) (*Client, error) {
	base := cfg.adminBaseURL()
	u, err := url.Parse(base)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return nil, fmt.Errorf("invalid fluss admin endpoint: %q", base)
	}

	return &Client{
		baseURL:      strings.TrimRight(base, "/"),
		httpClient:   &http.Client{Timeout: clientHTTPTimeout},
		saslEnabled:  cfg.SASLEnabled,
		saslMech:     cfg.SASLMechanism,
		saslUser:     cfg.SASLUsername,
		saslPassword: cfg.SASLPassword,
		zkEnsemble:   cfg.ZooKeeperEnsemble,
	}, nil
}

// Close releases idle HTTP connections.
func (c *Client) Close() error {
	if t, ok := c.httpClient.Transport.(*http.Transport); ok {
		t.CloseIdleConnections()
	}
	return nil
}

// applyAuth sets SASL auth on outgoing requests when configured. We pass the
// SASL handshake values as headers so the admin sidecar can forward them to
// the native RPC layer; the dashboard never speaks raw SASL itself.
func (c *Client) applyAuth(req *http.Request) {
	if !c.saslEnabled {
		return
	}
	req.Header.Set("X-Fluss-SASL-Mechanism", c.saslMech)
	req.SetBasicAuth(c.saslUser, c.saslPassword)
}

// get performs an authenticated GET and decodes JSON into out (if non-nil).
func (c *Client) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	c.applyAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("fluss request %s: %w", path, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("fluss GET %s: %d %s", path, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// PingCoordinator hits /api/v1/coordinator/info — used by HealthCheck to
// verify the CoordinatorServer is responsive.
func (c *Client) PingCoordinator(ctx context.Context) error {
	return c.get(ctx, "/api/v1/coordinator/info", nil)
}

// ListDatabases returns every database registered in the cluster.
func (c *Client) ListDatabases(ctx context.Context) ([]string, error) {
	var resp struct {
		Databases []string `json:"databases"`
	}
	if err := c.get(ctx, "/api/v1/databases", &resp); err != nil {
		return nil, err
	}
	return resp.Databases, nil
}

// ListTables returns the tables in a database with summary metadata.
func (c *Client) ListTables(ctx context.Context, database string) ([]FlussTableSummary, error) {
	var resp struct {
		Tables []FlussTableSummary `json:"tables"`
	}
	path := fmt.Sprintf("/api/v1/databases/%s/tables", url.PathEscape(database))
	if err := c.get(ctx, path, &resp); err != nil {
		return nil, err
	}
	for i := range resp.Tables {
		if resp.Tables[i].Database == "" {
			resp.Tables[i].Database = database
		}
	}
	return resp.Tables, nil
}

// GetTable returns full metadata for a single table.
func (c *Client) GetTable(ctx context.Context, database, table string) (*FlussTableMetadata, error) {
	var meta FlussTableMetadata
	path := fmt.Sprintf("/api/v1/databases/%s/tables/%s",
		url.PathEscape(database), url.PathEscape(table))
	if err := c.get(ctx, path, &meta); err != nil {
		return nil, err
	}
	if meta.Database == "" {
		meta.Database = database
	}
	if meta.Name == "" {
		meta.Name = table
	}
	return &meta, nil
}

// ListBuckets returns leadership/replica info for every bucket of a table.
func (c *Client) ListBuckets(ctx context.Context, database, table string) ([]BucketInfo, error) {
	var resp struct {
		Buckets []BucketInfo `json:"buckets"`
	}
	path := fmt.Sprintf("/api/v1/databases/%s/tables/%s/buckets",
		url.PathEscape(database), url.PathEscape(table))
	if err := c.get(ctx, path, &resp); err != nil {
		return nil, err
	}
	return resp.Buckets, nil
}

// ListTabletServers returns the health of every TabletServer in the cluster.
func (c *Client) ListTabletServers(ctx context.Context) ([]TabletServerHealth, error) {
	var resp struct {
		TabletServers []TabletServerHealth `json:"tabletServers"`
	}
	if err := c.get(ctx, "/api/v1/tablet-servers", &resp); err != nil {
		return nil, err
	}
	return resp.TabletServers, nil
}

// dialZK opens a short TCP connection to the ZK ensemble. Fluss tracks
// coordinator leadership in ZK; failure to reach ZK ahead of the coordinator
// probe lets us emit a more specific health category.
//
// The ensemble is comma-separated host:port pairs; we attempt them in order
// and return success on the first one that connects.
func dialZK(ctx context.Context, ensemble string) error {
	if ensemble == "" {
		return fmt.Errorf("zk ensemble not configured")
	}
	d := &net.Dialer{Timeout: zkDialTimeout}
	var lastErr error
	for hp := range strings.SplitSeq(ensemble, ",") {
		hp = strings.TrimSpace(hp)
		if hp == "" {
			continue
		}
		conn, err := d.DialContext(ctx, "tcp", hp)
		if err != nil {
			lastErr = err
			continue
		}
		_ = conn.Close()
		return nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("no zk hosts reachable")
	}
	return lastErr
}
