package graphql_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	ws "github.com/gorilla/websocket"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/generated"
)

// wsMessage represents a graphql-ws protocol message.
type wsMessage struct {
	ID      string          `json:"id,omitempty"`
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

func newTestServer(resolver *graphql.Resolver) *httptest.Server {
	gqlSrv := handler.New(generated.NewExecutableSchema(generated.Config{
		Resolvers: resolver,
	}))
	gqlSrv.AddTransport(transport.Options{})
	gqlSrv.AddTransport(transport.POST{})
	gqlSrv.AddTransport(&transport.Websocket{
		KeepAlivePingInterval: 10 * time.Second,
		Upgrader: ws.Upgrader{
			CheckOrigin: func(_ *http.Request) bool { return true },
		},
	})
	return httptest.NewServer(gqlSrv)
}

func wsConnect(t *testing.T, serverURL string) *ws.Conn {
	t.Helper()
	url := "ws" + strings.TrimPrefix(serverURL, "http")
	conn, _, err := ws.DefaultDialer.Dial(url, http.Header{
		"Sec-WebSocket-Protocol": []string{"graphql-transport-ws"},
	})
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}

	// Send connection_init.
	writeMsg(t, conn, wsMessage{Type: "connection_init"})

	// Wait for connection_ack.
	msg := readMsg(t, conn, 5*time.Second)
	if msg.Type != "connection_ack" {
		t.Fatalf("expected connection_ack, got %s", msg.Type)
	}

	return conn
}

func writeMsg(t *testing.T, conn *ws.Conn, msg wsMessage) {
	t.Helper()
	data, _ := json.Marshal(msg)
	if err := conn.WriteMessage(ws.TextMessage, data); err != nil {
		t.Fatalf("write error: %v", err)
	}
}

func readMsg(t *testing.T, conn *ws.Conn, timeout time.Duration) wsMessage {
	t.Helper()
	_ = conn.SetReadDeadline(time.Now().Add(timeout))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	var msg wsMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatalf("unmarshal error: %v\ndata: %s", err, data)
	}
	return msg
}

func TestSubscription_JobStatusChanged(t *testing.T) {
	mock := &mockJobGetter{}
	mock.set([]flink.JobOverview{})

	poller := flink.NewPoller(mock, flink.WithPollInterval(50*time.Millisecond))
	defer poller.Stop()

	srv := newTestServer(&graphql.Resolver{Poller: poller})
	defer srv.Close()

	conn := wsConnect(t, srv.URL)
	defer func() { _ = conn.Close() }()

	// Subscribe.
	payload, _ := json.Marshal(map[string]any{
		"query": `subscription { jobStatusChanged { jobId jobName previousStatus currentStatus } }`,
	})
	writeMsg(t, conn, wsMessage{ID: "1", Type: "subscribe", Payload: payload})

	// Trigger a job status event by adding a job.
	mock.set([]flink.JobOverview{
		{JID: "test-job-1", Name: "TestJob", State: "RUNNING"},
	})

	// Read the "next" message.
	msg := readMsg(t, conn, 3*time.Second)
	if msg.Type != "next" {
		t.Fatalf("expected next, got %s", msg.Type)
	}

	var result struct {
		Data struct {
			JobStatusChanged struct {
				JobID          string  `json:"jobId"`
				JobName        string  `json:"jobName"`
				PreviousStatus *string `json:"previousStatus"`
				CurrentStatus  string  `json:"currentStatus"`
			} `json:"jobStatusChanged"`
		} `json:"data"`
	}
	if err := json.Unmarshal(msg.Payload, &result); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}

	evt := result.Data.JobStatusChanged
	if evt.JobID != "test-job-1" {
		t.Errorf("expected jobId 'test-job-1', got %q", evt.JobID)
	}
	if evt.JobName != "TestJob" {
		t.Errorf("expected jobName 'TestJob', got %q", evt.JobName)
	}
	if evt.CurrentStatus != "RUNNING" {
		t.Errorf("expected currentStatus 'RUNNING', got %q", evt.CurrentStatus)
	}
	if evt.PreviousStatus != nil {
		t.Errorf("expected previousStatus nil, got %q", *evt.PreviousStatus)
	}
}

func TestSubscription_SQLResults(t *testing.T) {
	// Mock SQL Gateway server.
	callCount := 0
	var mu sync.Mutex
	sqlGW := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		call := callCount
		callCount++
		mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		switch call {
		case 0:
			// First batch with nextUri.
			_ = json.NewEncoder(w).Encode(map[string]any{
				"columns": []map[string]string{
					{"name": "id", "dataType": "INT"},
					{"name": "name", "dataType": "VARCHAR"},
				},
				"data": []map[string]any{
					{"fields": []any{1, "alice"}},
				},
				"resultType":    "PAYLOAD",
				"isQueryResult": true,
				"nextUri":       "/v3/sessions/s1/operations/o1/result/1",
			})
		default:
			// Final batch, no nextUri.
			_ = json.NewEncoder(w).Encode(map[string]any{
				"columns": []map[string]string{
					{"name": "id", "dataType": "INT"},
					{"name": "name", "dataType": "VARCHAR"},
				},
				"data": []map[string]any{
					{"fields": []any{2, "bob"}},
				},
				"resultType":    "EOS",
				"isQueryResult": true,
			})
		}
	}))
	defer sqlGW.Close()

	sqlClient := flink.NewClient(flink.WithBaseURL(sqlGW.URL))
	srv := newTestServer(&graphql.Resolver{SQLClient: sqlClient})
	defer srv.Close()

	conn := wsConnect(t, srv.URL)
	defer func() { _ = conn.Close() }()

	payload, _ := json.Marshal(map[string]any{
		"query": `subscription { sqlResults(sessionHandle: "s1", operationHandle: "o1") { columns { name dataType } rows hasMore } }`,
	})
	writeMsg(t, conn, wsMessage{ID: "1", Type: "subscribe", Payload: payload})

	// First batch.
	msg := readMsg(t, conn, 3*time.Second)
	if msg.Type != "next" {
		t.Fatalf("expected next, got %s", msg.Type)
	}

	var batch1 struct {
		Data struct {
			SQLResults struct {
				Columns []struct {
					Name     string `json:"name"`
					DataType string `json:"dataType"`
				} `json:"columns"`
				Rows    [][]string `json:"rows"`
				HasMore bool       `json:"hasMore"`
			} `json:"sqlResults"`
		} `json:"data"`
	}
	if err := json.Unmarshal(msg.Payload, &batch1); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !batch1.Data.SQLResults.HasMore {
		t.Error("expected hasMore=true for first batch")
	}
	if len(batch1.Data.SQLResults.Columns) != 2 {
		t.Errorf("expected 2 columns, got %d", len(batch1.Data.SQLResults.Columns))
	}

	// Second batch (final).
	msg = readMsg(t, conn, 3*time.Second)
	if msg.Type != "next" {
		t.Fatalf("expected next, got %s", msg.Type)
	}

	var batch2 struct {
		Data struct {
			SQLResults struct {
				HasMore bool `json:"hasMore"`
			} `json:"sqlResults"`
		} `json:"data"`
	}
	_ = json.Unmarshal(msg.Payload, &batch2)
	if batch2.Data.SQLResults.HasMore {
		t.Error("expected hasMore=false for final batch")
	}

	// Subscription should complete.
	msg = readMsg(t, conn, 3*time.Second)
	if msg.Type != "complete" {
		t.Fatalf("expected complete, got %s", msg.Type)
	}
}

func TestSubscription_ClientDisconnectCleanup(t *testing.T) {
	mock := &mockJobGetter{}
	mock.set([]flink.JobOverview{})

	poller := flink.NewPoller(mock, flink.WithPollInterval(50*time.Millisecond))
	defer poller.Stop()

	srv := newTestServer(&graphql.Resolver{Poller: poller})
	defer srv.Close()

	conn := wsConnect(t, srv.URL)

	payload, _ := json.Marshal(map[string]any{
		"query": `subscription { jobStatusChanged { jobId currentStatus } }`,
	})
	writeMsg(t, conn, wsMessage{ID: "1", Type: "subscribe", Payload: payload})

	// Wait for poller to start (subscriber registered).
	time.Sleep(100 * time.Millisecond)

	initialSubs := poller.SubscriberCount()
	if initialSubs != 1 {
		t.Fatalf("expected 1 subscriber, got %d", initialSubs)
	}

	// Disconnect client.
	_ = conn.Close()

	// Wait for cleanup.
	time.Sleep(200 * time.Millisecond)

	finalSubs := poller.SubscriberCount()
	if finalSubs != 0 {
		t.Errorf("expected 0 subscribers after disconnect, got %d", finalSubs)
	}
}

// mockJobGetter for subscription tests — implements flink.JobGetter.
type mockJobGetter struct {
	mu       sync.Mutex
	response *flink.JobsOverview
}

func (m *mockJobGetter) set(jobs []flink.JobOverview) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.response = &flink.JobsOverview{Jobs: jobs}
}

func (m *mockJobGetter) GetJobs(_ context.Context) (*flink.JobsOverview, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.response, nil
}
