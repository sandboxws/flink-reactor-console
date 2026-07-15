package kafka

import (
	"context"
	"regexp"
	"strings"

	instruments "github.com/sandboxws/flink-reactor-console/server/internal/instruments"
)

// Patterns to extract topic references from Flink SQL.
// Matches identifiers (quoted or unquoted) in FROM and INSERT INTO clauses,
// and 'topic' = '...' in connector properties.
var (
	fromPattern       = regexp.MustCompile(`(?i)\bFROM\s+` + "`?" + `([a-zA-Z0-9_.-]+)` + "`?")
	insertIntoPattern = regexp.MustCompile(`(?i)\bINSERT\s+INTO\s+` + "`?" + `([a-zA-Z0-9_.-]+)` + "`?")
	topicPropPattern  = regexp.MustCompile(`(?i)'topic'\s*=\s*'([^']+)'`)
)

// HighlightResources identifies Kafka topics referenced in pipeline SQL.
func (i *Instrument) HighlightResources(ctx context.Context, pipelineSQL string) ([]instruments.ResourceRef, error) {
	if i.client == nil {
		return nil, nil
	}

	// Get all known topic names.
	topicNames, err := i.client.TopicNames(ctx)
	if err != nil {
		return nil, err
	}

	knownTopics := make(map[string]bool, len(topicNames))
	for _, name := range topicNames {
		knownTopics[name] = true
	}

	// Extract identifiers from SQL.
	refs := make(map[string]string) // topic -> role

	for _, match := range fromPattern.FindAllStringSubmatch(pipelineSQL, -1) {
		refs[match[1]] = "source"
	}

	for _, match := range insertIntoPattern.FindAllStringSubmatch(pipelineSQL, -1) {
		refs[match[1]] = "sink"
	}

	// Also check connector property strings like 'topic' = 'my-topic'.
	for _, match := range topicPropPattern.FindAllStringSubmatch(pipelineSQL, -1) {
		topicVal := match[1]
		// If it contains comma-separated topics, split them.
		for _, t := range strings.Split(topicVal, ",") {
			t = strings.TrimSpace(t)
			if t != "" {
				if _, exists := refs[t]; !exists {
					refs[t] = "source" // topic properties are typically for sources
				}
			}
		}
	}

	// Match against known Kafka topics.
	var result []instruments.ResourceRef
	for name, role := range refs {
		if knownTopics[name] {
			result = append(result, instruments.ResourceRef{
				Name:             name,
				Role:             role,
				PipelineRelevant: true,
			})
		}
	}

	return result, nil
}
