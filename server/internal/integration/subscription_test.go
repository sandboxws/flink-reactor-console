package integration

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
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

	// Mock SQL Gateway — route by path, not by call count, because
	// server.New() may run catalog initialization in the background.
	var resultCalls int
	var mu sync.Mutex
	sqlGW := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/sessions"):
			_ = json.NewEncoder(w).Encode(map[string]string{"sessionHandle": "test-init-session"})
		case r.Method == http.MethodPost && strings.Contains(r.URL.Path, "/statements"):
			_ = json.NewEncoder(w).Encode(map[string]string{"operationHandle": "test-init-op"})
		case r.Method == http.MethodDelete:
			w.WriteHeader(http.StatusOK)
		case r.Method == http.MethodGet && strings.Contains(r.URL.Path, "/result/"):
			// Subscription uses session "s1"; initializer uses other sessions.
			if !strings.Contains(r.URL.Path, "/sessions/s1/") {
				// Return empty result for initializer DDL fetches.
				_ = json.NewEncoder(w).Encode(map[string]any{
					"results":    map[string]any{"columns": []any{}, "data": []any{}},
					"resultType": "EOS",
				})
				return
			}

			mu.Lock()
			call := resultCalls
			resultCalls++
			mu.Unlock()

			if call == 0 {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"results": map[string]any{
						"columns": []map[string]any{{"name": "id", "logicalType": map[string]any{"type": "INT", "nullable": false}}},
						"data":    []map[string]any{{"kind": "INSERT", "fields": []any{1}}},
					},
					"resultType":    "PAYLOAD",
					"isQueryResult": true,
					"nextResultUri": "/v3/sessions/s1/operations/o1/result/1",
				})
			} else {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"results": map[string]any{
						"columns": []map[string]any{{"name": "id", "logicalType": map[string]any{"type": "INT", "nullable": false}}},
						"data":    []map[string]any{{"kind": "INSERT", "fields": []any{2}}},
					},
					"resultType":    "EOS",
					"isQueryResult": true,
				})
			}
		default:
			http.NotFound(w, r)
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
