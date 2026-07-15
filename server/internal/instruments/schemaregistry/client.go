// Package schemaregistry implements the Schema Registry instrument for browsing
// subjects, viewing schemas, and checking compatibility against a Confluent
// Schema Registry (or compatible API like Karapace, Apicurio).
package schemaregistry

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
)

// AuthType selects how requests authenticate against the Schema Registry.
type AuthType string

// Supported authentication modes.
const (
	AuthNone   AuthType = "none"
	AuthBasic  AuthType = "basic"
	AuthBearer AuthType = "bearer"
)

// AuthConfig configures authentication for outgoing Schema Registry requests.
type AuthConfig struct {
	Type     AuthType `json:"type,omitempty"`
	Username string   `json:"username,omitempty"`
	Password string   `json:"password,omitempty"` //nolint:gosec // G101: config field, not a hardcoded credential
	Token    string   `json:"token,omitempty"`
}

// SchemaReference is one cross-subject reference embedded in a schema.
type SchemaReference struct {
	Name    string `json:"name"`
	Subject string `json:"subject"`
	Version int    `json:"version"`
}

// SubjectSummary is a row in the subject list: name + latest version metadata.
type SubjectSummary struct {
	Name          string
	LatestVersion int
	SchemaType    string
	SchemaID      int
	Compatibility string
}

// SchemaDetail is the full content of a single schema version.
type SchemaDetail struct {
	Subject    string
	Version    int
	ID         int
	SchemaType string
	Schema     string
	References []SchemaReference
}

// SubjectConfig is the per-subject compatibility configuration.
type SubjectConfig struct {
	Compatibility string
}

// CompatibilityResult is the result of a compatibility check.
type CompatibilityResult struct {
	IsCompatible bool
	Messages     []string
}

// Client wraps net/http with Schema Registry endpoints.
type Client struct {
	baseURL    string
	httpClient *http.Client
	auth       AuthConfig
}

// NewClient creates a Schema Registry client.
func NewClient(baseURL string, auth AuthConfig) (*Client, error) {
	if baseURL == "" {
		return nil, fmt.Errorf("schema registry url required")
	}
	u, err := url.Parse(baseURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return nil, fmt.Errorf("invalid schema registry url: %q", baseURL)
	}

	if auth.Type == "" {
		auth.Type = AuthNone
	}

	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{Timeout: 15 * time.Second},
		auth:       auth,
	}, nil
}

// Close releases idle connections held by the underlying HTTP transport.
func (c *Client) Close() error {
	if t, ok := c.httpClient.Transport.(*http.Transport); ok {
		t.CloseIdleConnections()
	} else if c.httpClient != nil {
		// Default transport — call its CloseIdleConnections via the public helper.
		http.DefaultTransport.(interface{ CloseIdleConnections() }).CloseIdleConnections()
	}
	return nil
}

// applyAuth sets the Authorization header (if any) on req.
func (c *Client) applyAuth(req *http.Request) {
	switch c.auth.Type {
	case AuthBasic:
		req.SetBasicAuth(c.auth.Username, c.auth.Password)
	case AuthBearer:
		req.Header.Set("Authorization", "Bearer "+c.auth.Token)
	case AuthNone:
		// no-op
	}
}

// get performs an authenticated GET and decodes JSON into out (if non-nil).
func (c *Client) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.schemaregistry.v1+json, application/json")
	c.applyAuth(req)

	resp, err := c.httpClient.Do(req) //nolint:gosec // G704: baseURL is an operator-configured instrument endpoint, not request-derived input
	if err != nil {
		return fmt.Errorf("schema registry request %s: %w", path, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("schema registry GET %s: %d %s", path, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// post performs an authenticated POST with a JSON body and decodes into out.
func (c *Client) post(ctx context.Context, path string, body, out any) error {
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			return err
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, &buf)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.schemaregistry.v1+json, application/json")
	req.Header.Set("Content-Type", "application/vnd.schemaregistry.v1+json")
	c.applyAuth(req)

	resp, err := c.httpClient.Do(req) //nolint:gosec // G704: baseURL is an operator-configured instrument endpoint, not request-derived input
	if err != nil {
		return fmt.Errorf("schema registry request %s: %w", path, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("schema registry POST %s: %d %s", path, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// Ping verifies the registry is reachable by listing subjects.
func (c *Client) Ping(ctx context.Context) error {
	var subjects []string
	if err := c.get(ctx, "/subjects", &subjects); err != nil {
		return fmt.Errorf("schema registry ping failed: %w", err)
	}
	return nil
}

// ListSubjects returns each subject with its latest version metadata. Per-subject
// failures are tolerated (the subject is returned with empty version info rather
// than failing the whole list).
func (c *Client) ListSubjects(ctx context.Context) ([]SubjectSummary, error) {
	var names []string
	if err := c.get(ctx, "/subjects", &names); err != nil {
		return nil, err
	}
	sort.Strings(names)

	out := make([]SubjectSummary, len(names))
	for i, name := range names {
		out[i] = SubjectSummary{Name: name}
	}

	// Fan out latest-version fetches with a small worker pool.
	const workers = 8
	jobs := make(chan int, workers)
	var wg sync.WaitGroup
	wg.Add(workers)

	for range workers {
		go func() {
			defer wg.Done()
			for i := range jobs {
				latest, err := c.fetchLatestVersion(ctx, names[i])
				if err == nil {
					out[i].LatestVersion = latest.Version
					out[i].SchemaType = latest.SchemaType
					out[i].SchemaID = latest.ID
				}
				if cfg, err := c.GetConfig(ctx, names[i]); err == nil && cfg != nil {
					out[i].Compatibility = cfg.Compatibility
				}
			}
		}()
	}
	for i := range names {
		jobs <- i
	}
	close(jobs)
	wg.Wait()

	return out, nil
}

// fetchLatestVersion is a small helper used by ListSubjects.
func (c *Client) fetchLatestVersion(ctx context.Context, subject string) (*SchemaDetail, error) {
	return c.GetSchemaDetail(ctx, subject, 0) // 0 → "latest"
}

// GetSubjectVersions returns the version numbers registered for a subject.
func (c *Client) GetSubjectVersions(ctx context.Context, subject string) ([]int, error) {
	var versions []int
	path := fmt.Sprintf("/subjects/%s/versions", url.PathEscape(subject))
	if err := c.get(ctx, path, &versions); err != nil {
		return nil, err
	}
	sort.Ints(versions)
	return versions, nil
}

// GetSchemaDetail returns the full schema for a subject/version. Pass version <= 0
// to fetch "latest".
func (c *Client) GetSchemaDetail(ctx context.Context, subject string, version int) (*SchemaDetail, error) {
	v := "latest"
	if version > 0 {
		v = fmt.Sprintf("%d", version)
	}
	path := fmt.Sprintf("/subjects/%s/versions/%s", url.PathEscape(subject), v)

	var resp struct {
		Subject    string            `json:"subject"`
		ID         int               `json:"id"`
		Version    int               `json:"version"`
		Schema     string            `json:"schema"`
		SchemaType string            `json:"schemaType"`
		References []SchemaReference `json:"references"`
	}
	if err := c.get(ctx, path, &resp); err != nil {
		return nil, err
	}
	if resp.SchemaType == "" {
		// Confluent omits schemaType for AVRO (the default).
		resp.SchemaType = "AVRO"
	}
	return &SchemaDetail{
		Subject:    resp.Subject,
		Version:    resp.Version,
		ID:         resp.ID,
		SchemaType: resp.SchemaType,
		Schema:     resp.Schema,
		References: resp.References,
	}, nil
}

// CheckCompatibility tests a candidate schema against the latest registered
// version of the subject. The endpoint is read-only on the registry.
func (c *Client) CheckCompatibility(ctx context.Context, subject, schema, schemaType string) (*CompatibilityResult, error) {
	if schemaType == "" {
		schemaType = "AVRO"
	}
	body := map[string]any{
		"schema":     schema,
		"schemaType": schemaType,
	}
	path := fmt.Sprintf("/compatibility/subjects/%s/versions/latest", url.PathEscape(subject))

	var resp struct {
		IsCompatible bool     `json:"is_compatible"`
		Messages     []string `json:"messages"`
	}
	if err := c.post(ctx, path, body, &resp); err != nil {
		return nil, err
	}
	return &CompatibilityResult{
		IsCompatible: resp.IsCompatible,
		Messages:     resp.Messages,
	}, nil
}

// GetConfig returns the per-subject compatibility level. Falls back to the
// global config when the subject has no override (registry returns 404).
func (c *Client) GetConfig(ctx context.Context, subject string) (*SubjectConfig, error) {
	var resp struct {
		Compatibility string `json:"compatibilityLevel"`
	}
	path := fmt.Sprintf("/config/%s", url.PathEscape(subject))
	if err := c.get(ctx, path, &resp); err != nil {
		// Subject-level config may not exist — try the global default. If that
		// also fails, surface the original error.
		if err2 := c.get(ctx, "/config", &resp); err2 != nil {
			return nil, err
		}
	}
	return &SubjectConfig{Compatibility: resp.Compatibility}, nil
}

// SubjectNames returns just the names (used by HighlightResources).
func (c *Client) SubjectNames(ctx context.Context) ([]string, error) {
	var names []string
	if err := c.get(ctx, "/subjects", &names); err != nil {
		return nil, err
	}
	return names, nil
}
