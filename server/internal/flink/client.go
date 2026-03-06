package flink

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

// Timeout tiers matching the TypeScript dashboard's per-operation timeouts.
const (
	TimeoutGet      = 10 * time.Second
	TimeoutPostJSON = 30 * time.Second
	TimeoutUpload   = 60 * time.Second
)

// Client is an HTTP client for the Flink REST API.
type Client struct {
	baseURL     string
	httpClient  *http.Client
	authHeader  string // pre-computed "Basic ..." or "Bearer ..." or ""
	logger      *slog.Logger
	metricsHook MetricsHook
}

// NewClient creates a new Flink REST API client with the given options.
// Defaults: base URL "http://localhost:8081", no auth, http.DefaultClient, no-op logger.
func NewClient(opts ...ClientOption) *Client {
	c := &Client{
		baseURL:    "http://localhost:8081",
		httpClient: http.DefaultClient,
		logger:     slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// GetJSON sends a GET request and unmarshals the JSON response into result.
// Uses a 10-second timeout.
func (c *Client) GetJSON(ctx context.Context, path string, result any) error {
	return c.doRequest(ctx, http.MethodGet, path, nil, "", TimeoutGet, result)
}

// GetText sends a GET request with Accept: text/plain and returns the response body as a string.
// Uses a 10-second timeout.
func (c *Client) GetText(ctx context.Context, path string) (string, error) {
	reqURL := c.baseURL + path

	ctx, cancel := context.WithTimeout(ctx, TimeoutGet)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return "", fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Accept", "text/plain")
	if c.authHeader != "" {
		req.Header.Set("Authorization", c.authHeader)
	}

	start := time.Now()
	resp, err := c.httpClient.Do(req) //nolint:gosec // URL is constructed from trusted baseURL + caller path
	duration := time.Since(start)

	if err != nil {
		return "", c.classifyError(err, reqURL, TimeoutGet)
	}
	defer func() { _ = resp.Body.Close() }()

	c.logger.Debug("flink request",
		slog.String("method", http.MethodGet),
		slog.String("path", path),
		slog.Int("status", resp.StatusCode),
		slog.Duration("duration", duration),
	)
	if c.metricsHook != nil {
		c.metricsHook(http.MethodGet, path, resp.StatusCode, duration.Seconds())
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("reading response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", c.buildAPIError(resp.StatusCode, resp.Status, body)
	}

	return string(body), nil
}

// PostJSON sends a POST request with a JSON body and unmarshals the JSON response into result.
// Uses a 30-second timeout. If body is nil, an empty body with Content-Type: application/json is sent.
func (c *Client) PostJSON(ctx context.Context, path string, body any, result any) error {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshaling request body: %w", err)
		}
		reader = bytes.NewReader(data)
	}
	return c.doRequest(ctx, http.MethodPost, path, reader, "application/json", TimeoutPostJSON, result)
}

// PostForm sends a POST request with the given body and content type (for multipart uploads).
// Uses a 60-second timeout.
func (c *Client) PostForm(ctx context.Context, path string, body io.Reader, contentType string, result any) error {
	return c.doRequest(ctx, http.MethodPost, path, body, contentType, TimeoutUpload, result)
}

// Patch sends a PATCH request with no body and unmarshals the JSON response into result.
// Uses a 10-second timeout.
func (c *Client) Patch(ctx context.Context, path string, result any) error {
	return c.doRequest(ctx, http.MethodPatch, path, nil, "", TimeoutGet, result)
}

// Delete sends a DELETE request with no body and no response parsing.
// Uses a 10-second timeout.
func (c *Client) Delete(ctx context.Context, path string) error {
	reqURL := c.baseURL + path

	ctx, cancel := context.WithTimeout(ctx, TimeoutGet)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, reqURL, nil)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

	if c.authHeader != "" {
		req.Header.Set("Authorization", c.authHeader)
	}

	start := time.Now()
	resp, err := c.httpClient.Do(req) //nolint:gosec // URL is constructed from trusted baseURL + caller path
	duration := time.Since(start)

	if err != nil {
		return c.classifyError(err, reqURL, TimeoutGet)
	}
	defer func() { _ = resp.Body.Close() }()

	c.logger.Debug("flink request",
		slog.String("method", http.MethodDelete),
		slog.String("path", path),
		slog.Int("status", resp.StatusCode),
		slog.Duration("duration", duration),
	)
	if c.metricsHook != nil {
		c.metricsHook(http.MethodDelete, path, resp.StatusCode, duration.Seconds())
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return c.buildAPIError(resp.StatusCode, resp.Status, body)
	}

	// Drain and discard response body.
	_, _ = io.Copy(io.Discard, resp.Body)
	return nil
}

// doRequest is the internal helper for JSON request/response operations.
func (c *Client) doRequest(ctx context.Context, method, path string, body io.Reader, contentType string, timeout time.Duration, result any) error {
	reqURL := c.baseURL + path

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, method, reqURL, body)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if c.authHeader != "" {
		req.Header.Set("Authorization", c.authHeader)
	}

	start := time.Now()
	resp, err := c.httpClient.Do(req) //nolint:gosec // URL is constructed from trusted baseURL + caller path
	duration := time.Since(start)

	if err != nil {
		return c.classifyError(err, reqURL, timeout)
	}
	defer func() { _ = resp.Body.Close() }()

	c.logger.Debug("flink request",
		slog.String("method", method),
		slog.String("path", path),
		slog.Int("status", resp.StatusCode),
		slog.Duration("duration", duration),
	)
	if c.metricsHook != nil {
		c.metricsHook(method, path, resp.StatusCode, duration.Seconds())
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return c.buildAPIError(resp.StatusCode, resp.Status, respBody)
	}

	if result != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, result); err != nil {
			return fmt.Errorf("unmarshaling response: %w", err)
		}
	}

	return nil
}

// classifyError converts an HTTP client error into a typed error.
func (c *Client) classifyError(err error, url string, timeout time.Duration) error {
	if ctx := context.DeadlineExceeded; err == ctx {
		return &TimeoutError{URL: url, Timeout: timeout}
	}
	// Check if the context deadline was exceeded (wrapped error).
	if isTimeoutErr(err) {
		return &TimeoutError{URL: url, Timeout: timeout}
	}
	c.logger.Error("flink connection error",
		slog.String("url", url),
		slog.String("error", err.Error()),
	)
	return &ConnectionError{URL: url, Err: err}
}

// isTimeoutErr checks if the error is a context deadline exceeded or timeout error.
func isTimeoutErr(err error) bool {
	if err == context.DeadlineExceeded {
		return true
	}
	// net/http wraps context errors; check the error chain.
	type timeouter interface {
		Timeout() bool
	}
	if t, ok := err.(timeouter); ok {
		return t.Timeout()
	}
	return false
}

// buildAPIError creates an APIError, attempting to parse Flink's error response body.
func (c *Client) buildAPIError(statusCode int, status string, body []byte) *APIError {
	apiErr := &APIError{
		StatusCode: statusCode,
		Status:     status,
	}

	// Flink error responses have the shape: {"errors": [...]}
	var errBody struct {
		Errors []ErrorEntry `json:"errors"`
	}
	if err := json.Unmarshal(body, &errBody); err == nil {
		apiErr.Errors = errBody.Errors
	}

	return apiErr
}
