package connector

import (
	"encoding/json"

	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
)

// PipelineManifest mirrors the DSL's PipelineManifest type stored as JSON.
type PipelineManifest struct {
	PipelineName string          `json:"pipelineName"`
	Sources      []ManifestEntry `json:"sources"`
	Sinks        []ManifestEntry `json:"sinks"`
	Catalogs     []CatalogEntry  `json:"catalogs"`
	GeneratedAt  string          `json:"generatedAt"`
}

// ManifestEntry mirrors the DSL's ConnectorMeta type.
type ManifestEntry struct {
	NodeID              string            `json:"nodeId"`
	ComponentName       string            `json:"componentName"`
	Type                string            `json:"connectorType"`
	Role                string            `json:"role"`
	Resource            string            `json:"resource"`
	ConnectorProperties map[string]string `json:"connectorProperties"`
	Schema              []SchemaColumn    `json:"schema"`
}

// SchemaColumn represents a column in the connector's schema.
type SchemaColumn struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// CatalogEntry mirrors the DSL's CatalogMeta type.
type CatalogEntry struct {
	CatalogName string `json:"catalogName"`
	CatalogType string `json:"catalogType"`
	URI         string `json:"uri,omitempty"`
	Warehouse   string `json:"warehouse,omitempty"`
}

// Detector extracts source and sink connectors from Flink job data.
type Detector struct{}

// NewDetector creates a new connector detector.
func NewDetector() *Detector {
	return &Detector{}
}

// DetectFromJob extracts all connectors from a job detail aggregate.
// It tries manifest-based detection first (if manifestJSON is provided),
// then falls back to vertex name parsing.
func (d *Detector) DetectFromJob(agg *flink.JobDetailAggregate, manifestJSON json.RawMessage) []Ref {
	// Path 1: Manifest-based detection (structured, high confidence).
	if len(manifestJSON) > 0 {
		refs := d.detectFromManifest(manifestJSON)
		if len(refs) > 0 {
			return refs
		}
	}

	// Path 2: Vertex name parsing (best-effort, lower confidence).
	return d.detectFromVertices(agg)
}

// detectFromManifest parses a PipelineManifest JSON and extracts ConnectorRefs.
func (d *Detector) detectFromManifest(data json.RawMessage) []Ref {
	var manifest PipelineManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil
	}

	var refs []Ref

	for _, src := range manifest.Sources {
		refs = append(refs, Ref{
			VertexID:   src.NodeID,
			VertexName: src.ComponentName,
			Type:       normalizeConnectorType(src.Type),
			Role:       RoleSource,
			Resource:   src.Resource,
			Properties: src.ConnectorProperties,
			Confidence: 1.0,
			Method:     DetectionManifest,
		})
	}

	for _, sink := range manifest.Sinks {
		refs = append(refs, Ref{
			VertexID:   sink.NodeID,
			VertexName: sink.ComponentName,
			Type:       normalizeConnectorType(sink.Type),
			Role:       RoleSink,
			Resource:   sink.Resource,
			Properties: sink.ConnectorProperties,
			Confidence: 1.0,
			Method:     DetectionManifest,
		})
	}

	return refs
}

// detectFromVertices parses vertex names and plan nodes to detect connectors.
func (d *Detector) detectFromVertices(agg *flink.JobDetailAggregate) []Ref {
	if agg == nil || agg.Job == nil {
		return nil
	}

	// Build a plan node index by vertex ID.
	planNodes := make(map[string]flink.PlanNode)
	for _, n := range agg.Job.Plan.Nodes {
		planNodes[n.ID] = n
	}

	var refs []Ref
	seen := make(map[string]bool)

	for _, v := range agg.Job.Vertices {
		// Try vertex name parsing first.
		ref := parseVertexName(v.ID, v.Name)
		if ref != nil && !seen[ref.VertexID] {
			seen[ref.VertexID] = true
			refs = append(refs, *ref)
			continue
		}

		// Try plan node operator class.
		if pn, ok := planNodes[v.ID]; ok && ref == nil {
			ref = detectFromPlanNode(v.ID, v.Name, pn.Operator, pn.Description)
			if ref != nil && !seen[ref.VertexID] {
				seen[ref.VertexID] = true
				refs = append(refs, *ref)
			}
		}
	}

	return refs
}

// normalizeConnectorType maps string connector types to the canonical Type.
func normalizeConnectorType(s string) Type {
	switch s {
	case "kafka", "upsert-kafka":
		return ConnectorKafka
	case "iceberg":
		return ConnectorIceberg
	case "paimon":
		return ConnectorPaimon
	case "jdbc":
		return ConnectorJDBC
	case "filesystem":
		return ConnectorFileSystem
	default:
		return ConnectorUnknown
	}
}
