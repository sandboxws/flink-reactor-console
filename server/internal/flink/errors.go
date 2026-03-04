package flink

import (
	"fmt"
	"time"
)

// ErrorEntry represents a single error entry from a Flink REST error response body.
type ErrorEntry struct {
	Message   string   `json:"message"`
	RootCause []string `json:"root-cause,omitempty"`
}

// APIError represents a non-2xx response from the Flink REST API.
type APIError struct {
	StatusCode int
	Status     string
	Errors     []ErrorEntry
}

func (e *APIError) Error() string {
	if len(e.Errors) > 0 {
		return fmt.Sprintf("flink api error %d: %s", e.StatusCode, e.Errors[0].Message)
	}
	return fmt.Sprintf("flink api error %d: %s", e.StatusCode, e.Status)
}

// ConnectionError wraps connection failures (DNS, refused, etc.).
type ConnectionError struct {
	URL string
	Err error
}

func (e *ConnectionError) Error() string {
	return fmt.Sprintf("connection error for %s: %v", e.URL, e.Err)
}

func (e *ConnectionError) Unwrap() error {
	return e.Err
}

// TimeoutError wraps context deadline exceeded errors.
type TimeoutError struct {
	URL     string
	Timeout time.Duration
}

func (e *TimeoutError) Error() string {
	return fmt.Sprintf("request to %s timed out after %s", e.URL, e.Timeout)
}
