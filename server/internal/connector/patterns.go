package connector

import (
	"regexp"
	"strings"
)

// Vertex name patterns for non-DSL jobs.
// Flink generates vertex names like:
//   "Source: KafkaSource-orders"
//   "Sink: IcebergSink-analytics.db.events"
//   "Source: TableSourceScan(table=[[default_catalog, default_database, orders]], ...)"
var (
	// sourcePrefix matches "Source: <rest>" or "Source:" at the start of a vertex name.
	sourcePrefix = regexp.MustCompile(`(?i)^Source:\s*(.+)`)
	// sinkPrefix matches "Sink: <rest>" or "Sink:" at the start of a vertex name.
	sinkPrefix = regexp.MustCompile(`(?i)^Sink:\s*(.+)`)
)

// Connector-specific patterns applied to the remainder after stripping Source:/Sink:.
var (
	kafkaPattern      = regexp.MustCompile(`(?i)kafka[_-]?(source|sink)?[_-]?(.*)`)
	icebergPattern    = regexp.MustCompile(`(?i)iceberg[_-]?(source|sink)?[_-]?(.*)`)
	paimonPattern     = regexp.MustCompile(`(?i)paimon[_-]?(source|sink)?[_-]?(.*)`)
	flussPattern      = regexp.MustCompile(`(?i)fluss[_-]?(source|sink)?[_-]?(.*)`)
	jdbcPattern       = regexp.MustCompile(`(?i)jdbc[_-]?(source|sink|lookup)?[_-]?(.*)`)
	filesystemPattern = regexp.MustCompile(`(?i)file[_-]?system[_-]?(source|sink)?[_-]?(.*)`)

	// tableSourceScan matches Flink's generated vertex names for table API sources.
	tableSourceScan = regexp.MustCompile(`TableSourceScan\(table=\[\[([^\]]+)\]\]`)
	// tableSinkScan matches Flink's generated vertex names for table API sinks.
	tableSinkModify = regexp.MustCompile(`(?:Sink|Writer|Committer).*\(table=\[\[([^\]]+)\]\]`)

	// operatorClassPattern matches Java class names that reveal connector type.
	operatorClassPatterns = map[ConnectorType]*regexp.Regexp{
		ConnectorKafka:      regexp.MustCompile(`(?i)kafka`),
		ConnectorIceberg:    regexp.MustCompile(`(?i)iceberg`),
		ConnectorPaimon:     regexp.MustCompile(`(?i)paimon`),
		ConnectorFluss:      regexp.MustCompile(`(?i)fluss`),
		ConnectorJDBC:       regexp.MustCompile(`(?i)jdbc`),
		ConnectorFileSystem: regexp.MustCompile(`(?i)filesystem`),
	}
)

// parseVertexName extracts connector information from a Flink vertex name.
// Returns nil if no connector can be detected.
func parseVertexName(vertexID, vertexName string) *ConnectorRef {
	// Detect role from prefix.
	var role ConnectorRole
	var remainder string

	if m := sourcePrefix.FindStringSubmatch(vertexName); m != nil {
		role = RoleSource
		remainder = strings.TrimSpace(m[1])
	} else if m := sinkPrefix.FindStringSubmatch(vertexName); m != nil {
		role = RoleSink
		remainder = strings.TrimSpace(m[1])
	} else {
		// No Source:/Sink: prefix — try table scan patterns.
		if m := tableSourceScan.FindStringSubmatch(vertexName); m != nil {
			return tableRefFromParts(vertexID, vertexName, m[1], RoleSource)
		}
		if m := tableSinkModify.FindStringSubmatch(vertexName); m != nil {
			return tableRefFromParts(vertexID, vertexName, m[1], RoleSink)
		}
		return nil
	}

	// Try connector-specific patterns.
	if m := kafkaPattern.FindStringSubmatch(remainder); m != nil {
		resource := strings.TrimSpace(m[2])
		return &ConnectorRef{
			VertexID:   vertexID,
			VertexName: vertexName,
			Type:       ConnectorKafka,
			Role:       role,
			Resource:   resource,
			Confidence: 0.8,
			Method:     DetectionVertexName,
		}
	}

	if m := icebergPattern.FindStringSubmatch(remainder); m != nil {
		resource := strings.TrimSpace(m[2])
		return &ConnectorRef{
			VertexID:   vertexID,
			VertexName: vertexName,
			Type:       ConnectorIceberg,
			Role:       role,
			Resource:   resource,
			Confidence: 0.8,
			Method:     DetectionVertexName,
		}
	}

	if m := paimonPattern.FindStringSubmatch(remainder); m != nil {
		resource := strings.TrimSpace(m[2])
		return &ConnectorRef{
			VertexID:   vertexID,
			VertexName: vertexName,
			Type:       ConnectorPaimon,
			Role:       role,
			Resource:   resource,
			Confidence: 0.8,
			Method:     DetectionVertexName,
		}
	}

	if m := flussPattern.FindStringSubmatch(remainder); m != nil {
		resource := strings.TrimSpace(m[2])
		return &ConnectorRef{
			VertexID:   vertexID,
			VertexName: vertexName,
			Type:       ConnectorFluss,
			Role:       role,
			Resource:   resource,
			Confidence: 0.8,
			Method:     DetectionVertexName,
		}
	}

	if m := jdbcPattern.FindStringSubmatch(remainder); m != nil {
		resource := strings.TrimSpace(m[2])
		return &ConnectorRef{
			VertexID:   vertexID,
			VertexName: vertexName,
			Type:       ConnectorJDBC,
			Role:       role,
			Resource:   resource,
			Confidence: 0.7,
			Method:     DetectionVertexName,
		}
	}

	if m := filesystemPattern.FindStringSubmatch(remainder); m != nil {
		resource := strings.TrimSpace(m[2])
		return &ConnectorRef{
			VertexID:   vertexID,
			VertexName: vertexName,
			Type:       ConnectorFileSystem,
			Role:       role,
			Resource:   resource,
			Confidence: 0.7,
			Method:     DetectionVertexName,
		}
	}

	// Try table scan patterns within the remainder.
	if m := tableSourceScan.FindStringSubmatch(remainder); m != nil {
		return tableRefFromParts(vertexID, vertexName, m[1], role)
	}
	if m := tableSinkModify.FindStringSubmatch(remainder); m != nil {
		return tableRefFromParts(vertexID, vertexName, m[1], role)
	}

	// Generic detection — we know it's a source or sink but can't identify the type.
	return &ConnectorRef{
		VertexID:   vertexID,
		VertexName: vertexName,
		Type:       ConnectorUnknown,
		Role:       role,
		Resource:   remainder,
		Confidence: 0.5,
		Method:     DetectionVertexName,
	}
}

// tableRefFromParts builds a ConnectorRef from a Flink table reference like
// "default_catalog, default_database, orders".
func tableRefFromParts(vertexID, vertexName, tableParts string, role ConnectorRole) *ConnectorRef {
	parts := strings.Split(tableParts, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}

	resource := strings.Join(parts, ".")
	connType := inferTypeFromTableName(parts)

	return &ConnectorRef{
		VertexID:   vertexID,
		VertexName: vertexName,
		Type:       connType,
		Role:       role,
		Resource:   resource,
		Confidence: 0.6,
		Method:     DetectionVertexName,
	}
}

// inferTypeFromTableName tries to identify the connector type from catalog/table names.
func inferTypeFromTableName(parts []string) ConnectorType {
	for _, p := range parts {
		lp := strings.ToLower(p)
		switch {
		case strings.Contains(lp, "iceberg"):
			return ConnectorIceberg
		case strings.Contains(lp, "paimon"):
			return ConnectorPaimon
		case strings.Contains(lp, "fluss"):
			return ConnectorFluss
		case strings.Contains(lp, "kafka"):
			return ConnectorKafka
		case strings.Contains(lp, "jdbc"):
			return ConnectorJDBC
		}
	}
	return ConnectorUnknown
}

// detectFromPlanNode tries to detect a connector from a plan node's operator class name.
func detectFromPlanNode(vertexID, vertexName, operator, description string) *ConnectorRef {
	for connType, pattern := range operatorClassPatterns {
		if pattern.MatchString(operator) || pattern.MatchString(description) {
			role := RoleSource
			lowerOp := strings.ToLower(operator + " " + description)
			if strings.Contains(lowerOp, "sink") || strings.Contains(lowerOp, "writer") || strings.Contains(lowerOp, "committer") {
				role = RoleSink
			}
			return &ConnectorRef{
				VertexID:   vertexID,
				VertexName: vertexName,
				Type:       connType,
				Role:       role,
				Confidence: 0.6,
				Method:     DetectionPlanNode,
			}
		}
	}
	return nil
}
