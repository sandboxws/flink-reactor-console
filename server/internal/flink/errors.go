package flink

import (
	"fmt"
	"strings"
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
	RawBody    string // raw response body for error messages not matching known formats
}

func (e *APIError) Error() string {
	if msg := e.rootCauseMessage(); msg != "" {
		return fmt.Sprintf("flink api error %d: %s", e.StatusCode, msg)
	}
	if len(e.Errors) > 0 {
		return fmt.Sprintf("flink api error %d: %s", e.StatusCode, e.Errors[0].Message)
	}
	if e.RawBody != "" {
		return fmt.Sprintf("flink api error %d: %s", e.StatusCode, e.RawBody)
	}
	return fmt.Sprintf("flink api error %d: %s", e.StatusCode, e.Status)
}

// rootCauseMessage extracts the most useful error message from the error entries.
// Flink REST returns non-RestHandlerException errors as:
//
//	{"errors": ["Internal server error.", "<full stack trace>"]}
//
// The stack trace often contains "Caused by:" lines with the actual root cause.
func (e *APIError) rootCauseMessage() string {
	// Check all error entries for stack traces with "Caused by:" lines.
	for _, entry := range e.Errors {
		if cause := ExtractRootCause(entry.Message); cause != "" {
			return cause
		}
	}
	// If there are multiple entries, the second one is typically the stack trace.
	// Extract the first line (exception class + message) as a fallback.
	if len(e.Errors) > 1 && e.Errors[1].Message != "" {
		firstLine, _, _ := strings.Cut(e.Errors[1].Message, "\n")
		return strings.TrimSpace(firstLine)
	}
	return ""
}

// ExtractRootCause finds the deepest "Caused by:" line in a Java stack trace
// and returns just the exception message (class + description).
// It strips the Java exception class prefix (e.g. "org.apache.flink...Exception: ")
// to return a human-readable message.
func ExtractRootCause(stackTrace string) string {
	var lastCause string
	for _, line := range strings.Split(stackTrace, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "Caused by: ") {
			lastCause = strings.TrimPrefix(trimmed, "Caused by: ")
		}
	}
	if lastCause == "" {
		return ""
	}
	// Strip Java class prefix: "org.apache.flink.table.api.ValidationException: msg" → "msg"
	if idx := strings.Index(lastCause, ": "); idx != -1 {
		// Only strip if the prefix looks like a Java class name (contains dots)
		prefix := lastCause[:idx]
		if strings.Contains(prefix, ".") {
			return lastCause[idx+2:]
		}
	}
	return lastCause
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
