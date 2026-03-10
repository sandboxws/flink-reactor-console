// Package integration provides full-stack integration test utilities.
// Tests in this package exercise the complete HTTP → Echo → GraphQL → resolver → mock Flink path.
package integration

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	ws "github.com/gorilla/websocket"
	instruments "github.com/sandboxws/flink-reactor-instruments"
	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/server"
)

// testServer wraps a reactor server backed by a mock Flink cluster.
type testServer struct {
	Server    *server.Server
	FlinkMock *httptest.Server
}

// newTestServer creates a fully-configured reactor-server backed by a mock Flink HTTP server.
func newTestServer(t *testing.T, opts ...testServerOption) *testServer {
	t.Helper()

	cfg := &testServerConfig{}
	for _, o := range opts {
		o(cfg)
	}

	flinkMock := flink.NewMockServer()
	t.Cleanup(flinkMock.Close)

	clusterConfigs := []cluster.Config{
		{Name: "default", URL: flinkMock.URL, Default: true},
	}
	clusterConfigs = append(clusterConfigs, cfg.extraClusters...)

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	mgr := &cluster.Manager{}
	if err := mgr.Init(clusterConfigs, logger); err != nil {
		t.Fatalf("cluster manager init: %v", err)
	}

	var serverOpts []server.Option

	srv := server.New(":0", logger, mgr, cfg.registry, serverOpts...)

	return &testServer{
		Server:    srv,
		FlinkMock: flinkMock,
	}
}

type testServerConfig struct {
	extraClusters []cluster.Config
	registry      *instruments.Registry
}

type testServerOption func(*testServerConfig)

// graphqlResponse represents a parsed GraphQL JSON response.
type graphqlResponse struct {
	Data   json.RawMessage `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

// graphqlQuery sends a POST to /graphql and returns the parsed response.
func graphqlQuery(t *testing.T, e http.Handler, query string, variables ...map[string]any) graphqlResponse {
	t.Helper()

	reqBody := map[string]any{"query": query}
	if len(variables) > 0 && variables[0] != nil {
		reqBody["variables"] = variables[0]
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("graphqlQuery: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp graphqlResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("graphqlQuery: unmarshal failed: %v\nbody: %s", err, rec.Body.String())
	}
	return resp
}

// wsMessage represents a graphql-transport-ws protocol message.
type wsMessage struct {
	ID      string          `json:"id,omitempty"`
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// wsConnect establishes a WebSocket connection using graphql-transport-ws protocol.
func wsConnect(t *testing.T, serverURL string) *ws.Conn {
	t.Helper()
	url := "ws" + strings.TrimPrefix(serverURL, "http")
	conn, _, err := ws.DefaultDialer.Dial(url, http.Header{
		"Sec-WebSocket-Protocol": []string{"graphql-transport-ws"},
	})
	if err != nil {
		t.Fatalf("wsConnect: dial failed: %v", err)
	}

	// Send connection_init.
	writeWSMsg(t, conn, wsMessage{Type: "connection_init"})

	// Wait for connection_ack.
	msg := readWSMsg(t, conn, 5*time.Second)
	if msg.Type != "connection_ack" {
		t.Fatalf("wsConnect: expected connection_ack, got %s", msg.Type)
	}

	return conn
}

func writeWSMsg(t *testing.T, conn *ws.Conn, msg wsMessage) {
	t.Helper()
	data, _ := json.Marshal(msg)
	if err := conn.WriteMessage(ws.TextMessage, data); err != nil {
		t.Fatalf("writeWSMsg: %v", err)
	}
}

func readWSMsg(t *testing.T, conn *ws.Conn, timeout time.Duration) wsMessage {
	t.Helper()
	_ = conn.SetReadDeadline(time.Now().Add(timeout))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("readWSMsg: %v", err)
	}
	var msg wsMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatalf("readWSMsg: unmarshal: %v\ndata: %s", err, data)
	}
	return msg
}
