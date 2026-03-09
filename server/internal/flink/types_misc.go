package flink

// JarEntryPoint represents an entry point within a JAR.
type JarEntryPoint struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

// JarEntry represents a single JAR in the GET /jars response.
type JarEntry struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	Uploaded int64           `json:"uploaded"`
	Entry    []JarEntryPoint `json:"entry"`
}

// JarList represents the GET /jars response.
type JarList struct {
	Address string     `json:"address"`
	Files   []JarEntry `json:"files"`
}

// JarUploadResponse represents the POST /jars/upload response.
type JarUploadResponse struct {
	Filename string `json:"filename"`
	Status   string `json:"status"`
}

// JarRunResponse represents the POST /jars/:jarid/run response.
type JarRunResponse struct {
	JobID string `json:"jobid"`
}

// ClusterConfig represents the GET /config response (dashboard config with feature flags).
type ClusterConfig struct {
	RefreshInterval int    `json:"refresh-interval"`
	TimezoneName    string `json:"timezone-name"`
	TimezoneOffset  int    `json:"timezone-offset"`
	FlinkVersion    string `json:"flink-version"`
	FlinkRevision   string `json:"flink-revision"`
	Features        struct {
		WebSubmit  bool `json:"web-submit"`
		WebCancel  bool `json:"web-cancel"`
		WebRescale bool `json:"web-rescale"`
		WebHistory bool `json:"web-history"`
	} `json:"features"`
}

// SQLGatewaySessionResponse represents a SQL Gateway session creation response.
type SQLGatewaySessionResponse struct {
	SessionHandle string `json:"sessionHandle"`
}

// SQLGatewayOperationResponse represents a SQL Gateway operation submission response.
type SQLGatewayOperationResponse struct {
	OperationHandle string `json:"operationHandle"`
}

// SQLGatewayOperationStatusResponse represents a SQL Gateway operation status response.
type SQLGatewayOperationStatusResponse struct {
	Status string `json:"status"` // RUNNING, FINISHED, CANCELED, ERROR
}

// SQLGatewayLogicalType represents the type info for a column in v3 API responses.
type SQLGatewayLogicalType struct {
	Type     string `json:"type"`
	Nullable bool   `json:"nullable"`
}

// SQLGatewayColumn represents a column in a SQL Gateway result set.
type SQLGatewayColumn struct {
	Name        string                `json:"name"`
	LogicalType SQLGatewayLogicalType `json:"logicalType"`
}

// SQLGatewayRow represents a single row in a SQL Gateway result set.
type SQLGatewayRow struct {
	Kind   string `json:"kind"`
	Fields []any  `json:"fields"`
}

// SQLGatewayResults is the nested "results" wrapper in v3 API responses.
type SQLGatewayResults struct {
	Columns []SQLGatewayColumn `json:"columns"`
	Data    []SQLGatewayRow    `json:"data"`
}

// SQLGatewayResultSet represents a SQL Gateway v3 result set response.
// In v3, columns and data are nested under "results", and the next page
// URI is "nextResultUri" (not "nextUri").
type SQLGatewayResultSet struct {
	ResultType    string            `json:"resultType"`
	IsQueryResult bool              `json:"isQueryResult"`
	Results       SQLGatewayResults `json:"results"`
	NextResultURI *string           `json:"nextResultUri,omitempty"`
}
