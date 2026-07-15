package schemaregistry

import (
	"context"
	"regexp"
	"strings"

	instruments "github.com/sandboxws/flink-reactor-instruments"
)

// Patterns to extract Schema Registry subject references from Flink SQL.
//
// Flink connectors expose schema-registry properties either explicitly
// (e.g. 'value.avro-confluent.subject' = 'orders-value') or implicitly via
// the topic-name strategy ('{topic}-value' / '{topic}-key').
var (
	// Explicit subject overrides for Avro / Protobuf / JSON Schema connectors.
	// Captures the side ("key" or "value") and the subject name. Matches both
	// the modern property (`*.avro-confluent.subject`) and the older one
	// (`*.avro-confluent.schema-registry.subject`).
	explicitSubjectPattern = regexp.MustCompile(
		`(?i)'(key|value)\.(?:avro|protobuf|json)-confluent(?:\.schema-registry)?\.subject'\s*=\s*'([^']+)'`,
	)

	// Confluent format markers — when present we derive subjects from the topic.
	confluentFormatPattern = regexp.MustCompile(
		`(?i)'(key\.format|value\.format|format)'\s*=\s*'(avro-confluent|debezium-avro-confluent|protobuf-confluent|json-confluent)'`,
	)

	// 'topic' = 'name' inside the same WITH(...) block.
	topicPropPattern = regexp.MustCompile(`(?i)'topic'\s*=\s*'([^']+)'`)
)

// HighlightResources finds Schema Registry subjects referenced in pipeline SQL.
func (i *Instrument) HighlightResources(ctx context.Context, pipelineSQL string) ([]instruments.ResourceRef, error) {
	if i.client == nil {
		return nil, nil
	}

	candidates := extractSubjects(pipelineSQL)
	if len(candidates) == 0 {
		return nil, nil
	}

	names, err := i.client.SubjectNames(ctx)
	if err != nil {
		return nil, err
	}
	known := make(map[string]struct{}, len(names))
	for _, n := range names {
		known[n] = struct{}{}
	}

	var refs []instruments.ResourceRef
	for subject, role := range candidates {
		if _, ok := known[subject]; !ok {
			continue
		}
		refs = append(refs, instruments.ResourceRef{
			Name:             subject,
			Role:             role,
			PipelineRelevant: true,
		})
	}
	return refs, nil
}

// extractSubjects parses CREATE TABLE WITH(...) blocks for schema-registry
// subject references. Returns subject -> role.
//
// The role is derived from the property prefix:
//   - "value.*" → source (read)
//   - "key.*"  → source (key part of the same source)
//
// Strictly speaking, sinks would be tagged from a containing INSERT INTO. SQL
// parsing is out of scope here; downstream UI tooling can recover that from
// the kafka instrument's own role tagging.
func extractSubjects(sql string) map[string]string {
	subjects := make(map[string]string)

	// Walk each CREATE TABLE chunk. Track per-chunk which sides have an
	// explicit subject — that suppresses the topic-name fallback for that
	// side.
	for chunk := range strings.SplitSeq(sql, "CREATE TABLE") {
		var explicitKey, explicitValue bool

		// 1. Explicit subjects.
		for _, m := range explicitSubjectPattern.FindAllStringSubmatch(chunk, -1) {
			side, subject := strings.ToLower(m[1]), m[2]
			subjects[subject] = "source"
			if side == "key" {
				explicitKey = true
			} else {
				explicitValue = true
			}
		}

		// 2. Topic-name strategy: only fires when a Confluent format is set.
		hasFormat := confluentFormatPattern.FindAllStringSubmatch(chunk, -1)
		if len(hasFormat) == 0 {
			continue
		}

		var hasKeyFormat bool
		for _, fm := range hasFormat {
			if strings.HasPrefix(strings.ToLower(fm[1]), "key.format") {
				hasKeyFormat = true
				break
			}
		}

		for _, t := range topicPropPattern.FindAllStringSubmatch(chunk, -1) {
			topic := t[1]
			if !explicitValue {
				subjects[topic+"-value"] = "source"
			}
			if hasKeyFormat && !explicitKey {
				subjects[topic+"-key"] = "source"
			}
		}
	}

	return subjects
}
