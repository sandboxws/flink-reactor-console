package integration

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/server"
)

func TestIntegration_Subscription_JobStatusChanged(t *testing.T) {
	mock := &mockJobGetter{}
	mock.set([]flink.JobOverview{})

	poller := flink.NewPoller(mock, flink.WithPollInterval(50*time.Millisecond))
	defer poller.Stop()

	manager := cluster.NewTestManagerWithPoller(poller)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	srv := server.New(":0", logger, manager, nil)
	ts := httptest.NewServer(srv.Echo())
	defer ts.Close()

	conn := wsConnect(t, ts.URL+"/graphql")
	defer func() { _ = conn.Close() }()

	payload, _ := json.Marshal(map[string]any{
		"query": `subscription { jobStatusChanged { jobId jobName currentStatus cluster } }`,
	})
	writeWSMsg(t, conn, wsMessage{ID: "1", Type: "subscribe", Payload: payload})

	// Trigger a job status event.
	mock.set([]flink.JobOverview{
		{JID: "integration-job-1", Name: "IntegrationJob", State: "RUNNING"},
	})

	msg := readWSMsg(t, conn, 3*time.Second)
	if msg.Type != "next" {
		t.Fatalf("expected next, got %s", msg.Type)
	}

	var result struct {
		Data struct {
			JobStatusChanged struct {
				JobID         string `json:"jobId"`
				JobName       string `json:"jobName"`
				CurrentStatus string `json:"currentStatus"`
				Cluster       string `json:"cluster"`
			} `json:"jobStatusChanged"`
		} `json:"data"`
	}
	if err := json.Unmarshal(msg.Payload, &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	evt := result.Data.JobStatusChanged
	if evt.JobID != "integration-job-1" {
		t.Errorf("expected jobId 'integration-job-1', got %q", evt.JobID)
	}
	if evt.CurrentStatus != "RUNNING" {
		t.Errorf("expected status 'RUNNING', got %q", evt.CurrentStatus)
	}
}

func TestIntegration_Subscription_SQLResults(t *testing.T) {
	// Mock Flink server (for cluster connection).
	mockFlink := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.NotFound(w, nil)
	}))
	defer mockFlink.Close()

	// Mock SQL Gateway.
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
			_ = json.NewEncoder(w).Encode(map[string]any{
				"columns":       []map[string]string{{"name": "id", "dataType": "INT"}},
				"data":          []map[string]any{{"fields": []any{1}}},
				"resultType":    "PAYLOAD",
				"isQueryResult": true,
				"nextUri":       "/v3/sessions/s1/operations/o1/result/1",
			})
		default:
			_ = json.NewEncoder(w).Encode(map[string]any{
				"columns":       []map[string]string{{"name": "id", "dataType": "INT"}},
				"data":          []map[string]any{{"fields": []any{2}}},
				"resultType":    "EOS",
				"isQueryResult": true,
			})
		}
	}))
	defer sqlGW.Close()

	manager := cluster.NewTestManagerWithSQL(mockFlink, sqlGW)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := server.New(":0", logger, manager, nil)
	ts := httptest.NewServer(srv.Echo())
	defer ts.Close()

	conn := wsConnect(t, ts.URL+"/graphql")
	defer func() { _ = conn.Close() }()

	payload, _ := json.Marshal(map[string]any{
		"query": `subscription { sqlResults(sessionHandle: "s1", operationHandle: "o1") { columns { name dataType } rows hasMore } }`,
	})
	writeWSMsg(t, conn, wsMessage{ID: "1", Type: "subscribe", Payload: payload})

	// First batch (hasMore=true).
	msg := readWSMsg(t, conn, 3*time.Second)
	if msg.Type != "next" {
		t.Fatalf("expected next, got %s", msg.Type)
	}

	var batch struct {
		Data struct {
			SQLResults struct {
				HasMore bool `json:"hasMore"`
			} `json:"sqlResults"`
		} `json:"data"`
	}
	_ = json.Unmarshal(msg.Payload, &batch)
	if !batch.Data.SQLResults.HasMore {
		t.Error("expected hasMore=true for first batch")
	}

	// Final batch (hasMore=false).
	msg = readWSMsg(t, conn, 3*time.Second)
	if msg.Type != "next" {
		t.Fatalf("expected next, got %s", msg.Type)
	}

	_ = json.Unmarshal(msg.Payload, &batch)
	if batch.Data.SQLResults.HasMore {
		t.Error("expected hasMore=false for final batch")
	}

	// Subscription should complete.
	msg = readWSMsg(t, conn, 3*time.Second)
	if msg.Type != "complete" {
		t.Fatalf("expected complete, got %s", msg.Type)
	}
}

func TestIntegration_Subscription_ClientDisconnect(t *testing.T) {
	mock := &mockJobGetter{}
	mock.set([]flink.JobOverview{})

	poller := flink.NewPoller(mock, flink.WithPollInterval(50*time.Millisecond))
	defer poller.Stop()

	manager := cluster.NewTestManagerWithPoller(poller)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := server.New(":0", logger, manager, nil)
	ts := httptest.NewServer(srv.Echo())
	defer ts.Close()

	conn := wsConnect(t, ts.URL+"/graphql")

	payload, _ := json.Marshal(map[string]any{
		"query": `subscription { jobStatusChanged { jobId currentStatus cluster } }`,
	})
	writeWSMsg(t, conn, wsMessage{ID: "1", Type: "subscribe", Payload: payload})

	time.Sleep(100 * time.Millisecond)

	initialSubs := poller.SubscriberCount()
	if initialSubs != 1 {
		t.Fatalf("expected 1 subscriber, got %d", initialSubs)
	}

	// Disconnect.
	_ = conn.Close()
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
