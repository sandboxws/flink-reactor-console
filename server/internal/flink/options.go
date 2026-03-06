// Package flink provides an HTTP client for the Flink REST API.
package flink

import (
	"encoding/base64"
	"log/slog"
	"net/http"
)

// ClientOption configures a Client during construction.
type ClientOption func(*Client)

// WithBaseURL sets the Flink REST API base URL (e.g., "http://localhost:8081").
func WithBaseURL(url string) ClientOption {
	return func(c *Client) {
		c.baseURL = url
	}
}

// WithBasicAuth configures HTTP Basic authentication.
// The Authorization header is pre-computed as "Basic <base64(username:password)>".
func WithBasicAuth(username, password string) ClientOption {
	return func(c *Client) {
		encoded := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
		c.authHeader = "Basic " + encoded
	}
}

// WithBearerAuth configures Bearer token authentication.
func WithBearerAuth(token string) ClientOption {
	return func(c *Client) {
		c.authHeader = "Bearer " + token
	}
}

// WithHTTPClient sets a custom *http.Client for all HTTP operations.
func WithHTTPClient(client *http.Client) ClientOption {
	return func(c *Client) {
		c.httpClient = client
	}
}

// WithLogger sets the structured logger for request/error logging.
func WithLogger(logger *slog.Logger) ClientOption {
	return func(c *Client) {
		c.logger = logger
	}
}

// MetricsHook is called after each HTTP request with the method, path, status code, and duration.
type MetricsHook func(method, path string, statusCode int, durationSeconds float64)

// WithMetricsHook sets a callback that fires after every HTTP request for metrics collection.
func WithMetricsHook(hook MetricsHook) ClientOption {
	return func(c *Client) {
		c.metricsHook = hook
	}
}
