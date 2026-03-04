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
	TimezoneOffset  string `json:"timezone-offset"`
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

// SQLGatewayColumn represents a column in a SQL Gateway result set.
type SQLGatewayColumn struct {
	Name     string `json:"name"`
	DataType string `json:"dataType"`
}

// SQLGatewayRow represents a single row in a SQL Gateway result set.
type SQLGatewayRow struct {
	Fields []any `json:"fields"`
}

// SQLGatewayResultSet represents a SQL Gateway result set response.
type SQLGatewayResultSet struct {
	Columns       []SQLGatewayColumn `json:"columns"`
	Data          []SQLGatewayRow    `json:"data"`
	ResultType    string             `json:"resultType"`
	NextURI       *string            `json:"nextUri,omitempty"`
	IsQueryResult bool               `json:"isQueryResult"`
}
