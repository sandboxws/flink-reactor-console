// Package connector detects source and sink connectors from Flink job topology.
package connector

// ConnectorType identifies a connector technology.
type ConnectorType string

const (
	ConnectorKafka      ConnectorType = "kafka"
	ConnectorIceberg    ConnectorType = "iceberg"
	ConnectorPaimon     ConnectorType = "paimon"
	ConnectorJDBC       ConnectorType = "jdbc"
	ConnectorFileSystem ConnectorType = "filesystem"
	ConnectorUnknown    ConnectorType = "unknown"
)

// ConnectorRole identifies whether the connector is a source or sink.
type ConnectorRole string

const (
	RoleSource ConnectorRole = "source"
	RoleSink   ConnectorRole = "sink"
)

// DetectionMethod indicates how the connector was detected.
type DetectionMethod string

const (
	DetectionManifest    DetectionMethod = "manifest"
	DetectionVertexName  DetectionMethod = "vertex_name"
	DetectionPlanNode    DetectionMethod = "plan_node"
)

// ConnectorRef is a unified reference to a detected source or sink.
type ConnectorRef struct {
	// VertexID links back to the Flink job vertex.
	VertexID string
	// VertexName is the operator name from the Flink job graph.
	VertexName string
	// Type is the detected connector technology.
	Type ConnectorType
	// Role is source or sink.
	Role ConnectorRole
	// Resource is the primary identifier (topic, table, path).
	Resource string
	// Properties are raw connector key-value pairs (from manifest only).
	Properties map[string]string
	// Confidence is 0.0-1.0 indicating detection reliability.
	Confidence float64
	// Method indicates how the connector was detected.
	Method DetectionMethod
}
