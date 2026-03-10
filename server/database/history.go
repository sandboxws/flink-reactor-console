package database

import (
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"
)

const historyCapacity = 100

// ddlPattern matches DDL keywords at word boundaries (case-insensitive).
var ddlPattern = regexp.MustCompile(`(?i)\b(CREATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE)\b`)

// QueryHistoryEntry records a single query execution.
type QueryHistoryEntry struct {
	SQL             string
	ExecutedAt      time.Time
	ExecutionTimeMs int64
	RowCount        int
	Error           string
}

// History is a thread-safe ring buffer of query history entries.
type History struct {
	mu      sync.RWMutex
	entries []QueryHistoryEntry
	head    int
	count   int
}

// NewHistory creates a new query history ring buffer.
func NewHistory() *History {
	return &History{
		entries: make([]QueryHistoryEntry, historyCapacity),
	}
}

// Add appends an entry to the history ring buffer.
func (h *History) Add(entry QueryHistoryEntry) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.entries[h.head] = entry
	h.head = (h.head + 1) % historyCapacity
	if h.count < historyCapacity {
		h.count++
	}
}

// List returns all history entries in reverse chronological order.
func (h *History) List() []QueryHistoryEntry {
	h.mu.RLock()
	defer h.mu.RUnlock()

	result := make([]QueryHistoryEntry, h.count)
	for i := range h.count {
		// Walk backwards from head
		idx := (h.head - 1 - i + historyCapacity) % historyCapacity
		result[i] = h.entries[idx]
	}
	return result
}

// CheckDDL returns an error if the SQL contains DDL statements.
func CheckDDL(sql string) error {
	// Strip string literals to avoid false positives
	stripped := stripStringLiterals(sql)
	if ddlPattern.MatchString(stripped) {
		return fmt.Errorf("DDL statements (CREATE, DROP, ALTER, TRUNCATE, GRANT, REVOKE) are not allowed")
	}
	return nil
}

// stripStringLiterals removes single-quoted string literals from SQL
// to prevent false positive DDL detection on values like 'CREATE something'.
func stripStringLiterals(sql string) string {
	var b strings.Builder
	inString := false
	for i := 0; i < len(sql); i++ {
		if sql[i] == '\'' {
			if inString {
				// Check for escaped quote
				if i+1 < len(sql) && sql[i+1] == '\'' {
					i++ // Skip escaped quote
					continue
				}
				inString = false
			} else {
				inString = true
			}
			continue
		}
		if !inString {
			b.WriteByte(sql[i])
		}
	}
	return b.String()
}
