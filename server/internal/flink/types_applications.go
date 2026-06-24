package flink

// ApplicationOverview is one entry in GET /applications/overview, part of the
// cluster→application→job hierarchy introduced in Flink 2.3 (FLIP-549).
// Decoding is tolerant: unknown fields are ignored, so this survives minor
// differences in the released 2.3 response shape.
type ApplicationOverview struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	State     string `json:"state"`
	StartTime int64  `json:"start-time,omitempty"`
	JobCount  int    `json:"job-count,omitempty"`
}

// ApplicationList wraps the GET /applications/overview response.
type ApplicationList struct {
	Applications []ApplicationOverview `json:"applications"`
}
