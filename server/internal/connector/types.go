// Package connector detects source and sink connectors from Flink job topology.
package connector

// Type identifies a connector technology.
type Type string

// Connector technologies the detector can recognise.
const (
	ConnectorKafka      Type = "kafka"
	ConnectorIceberg    Type = "iceberg"
	ConnectorPaimon     Type = "paimon"
	ConnectorFluss      Type = "fluss"
	ConnectorJDBC       Type = "jdbc"
	ConnectorFileSystem Type = "filesystem"
	ConnectorUnknown    Type = "unknown"
)

// Role identifies whether the connector is a source or sink.
type Role string

// The directions a connector can face.
const (
	RoleSource Role = "source"
	RoleSink   Role = "sink"
)

// DetectionMethod indicates how the connector was detected.
type DetectionMethod string

// How a connector was detected, in descending order of confidence.
const (
	DetectionManifest   DetectionMethod = "manifest"
	DetectionVertexName DetectionMethod = "vertex_name"
	DetectionPlanNode   DetectionMethod = "plan_node"
)

// Ref is a unified reference to a detected source or sink.
type Ref struct {
	// VertexID links back to the Flink job vertex.
	VertexID string
	// VertexName is the operator name from the Flink job graph.
	VertexName string
	// Type is the detected connector technology.
	Type Type
	// Role is source or sink.
	Role Role
	// Resource is the primary identifier (topic, table, path).
	Resource string
	// Properties are raw connector key-value pairs (from manifest only).
	Properties map[string]string
	// Confidence is 0.0-1.0 indicating detection reliability.
	Confidence float64
	// Method indicates how the connector was detected.
	Method DetectionMethod
}
