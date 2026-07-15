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
	"github.com/sandboxws/flink-reactor-console/server/internal/cluster"
	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
	"github.com/sandboxws/flink-reactor-console/server/internal/graphql"
	"github.com/sandboxws/flink-reactor-console/server/internal/graphql/generated"
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

	manager := cluster.NewTestManagerWithPoller(poller)

	srv := newTestServer(&graphql.Resolver{Manager: manager})
	defer srv.Close()

	conn := wsConnect(t, srv.URL)
	defer func() { _ = conn.Close() }()

	// Subscribe.
	payload, _ := json.Marshal(map[string]any{
		"query": `subscription { jobStatusChanged { jobId jobName previousStatus currentStatus cluster } }`,
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
				Cluster        string  `json:"cluster"`
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
	if evt.Cluster != "default" {
		t.Errorf("expected cluster 'default', got %q", evt.Cluster)
	}
}

func TestSubscription_JobStatusChanged_ExplicitCluster(t *testing.T) {
	mock := &mockJobGetter{}
	mock.set([]flink.JobOverview{})

	poller := flink.NewPoller(mock, flink.WithPollInterval(50*time.Millisecond))
	defer poller.Stop()

	manager := cluster.NewTestManagerWithPoller(poller)

	srv := newTestServer(&graphql.Resolver{Manager: manager})
	defer srv.Close()

	conn := wsConnect(t, srv.URL)
	defer func() { _ = conn.Close() }()

	// Subscribe with explicit cluster name.
	payload, _ := json.Marshal(map[string]any{
		"query": `subscription { jobStatusChanged(cluster: "default") { jobId currentStatus cluster } }`,
	})
	writeMsg(t, conn, wsMessage{ID: "1", Type: "subscribe", Payload: payload})

	mock.set([]flink.JobOverview{
		{JID: "job-2", Name: "Job2", State: "CANCELED"},
	})

	msg := readMsg(t, conn, 3*time.Second)
	if msg.Type != "next" {
		t.Fatalf("expected next, got %s", msg.Type)
	}

	var result struct {
		Data struct {
			JobStatusChanged struct {
				Cluster string `json:"cluster"`
			} `json:"jobStatusChanged"`
		} `json:"data"`
	}
	_ = json.Unmarshal(msg.Payload, &result)
	if result.Data.JobStatusChanged.Cluster != "default" {
		t.Errorf("expected cluster 'default', got %q", result.Data.JobStatusChanged.Cluster)
	}
}

func TestSubscription_SQLResults(t *testing.T) {
	// Mock Flink server (for the cluster connection).
	mockFlink := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.NotFound(w, nil)
	}))
	defer mockFlink.Close()

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
			// First batch with nextResultUri.
			_ = json.NewEncoder(w).Encode(map[string]any{
				"results": map[string]any{
					"columns": []map[string]any{
						{"name": "id", "logicalType": map[string]any{"type": "INT", "nullable": false}},
						{"name": "name", "logicalType": map[string]any{"type": "VARCHAR", "nullable": true}},
					},
					"data": []map[string]any{
						{"kind": "INSERT", "fields": []any{1, "alice"}},
					},
				},
				"resultType":    "PAYLOAD",
				"isQueryResult": true,
				"nextResultUri": "/v3/sessions/s1/operations/o1/result/1",
			})
		default:
			// Final batch, no nextResultUri.
			_ = json.NewEncoder(w).Encode(map[string]any{
				"results": map[string]any{
					"columns": []map[string]any{
						{"name": "id", "logicalType": map[string]any{"type": "INT", "nullable": false}},
						{"name": "name", "logicalType": map[string]any{"type": "VARCHAR", "nullable": true}},
					},
					"data": []map[string]any{
						{"kind": "INSERT", "fields": []any{2, "bob"}},
					},
				},
				"resultType":    "EOS",
				"isQueryResult": true,
			})
		}
	}))
	defer sqlGW.Close()

	manager := cluster.NewTestManagerWithSQL(mockFlink, sqlGW)
	srv := newTestServer(&graphql.Resolver{Manager: manager})
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

	manager := cluster.NewTestManagerWithPoller(poller)

	srv := newTestServer(&graphql.Resolver{Manager: manager})
	defer srv.Close()

	conn := wsConnect(t, srv.URL)

	payload, _ := json.Marshal(map[string]any{
		"query": `subscription { jobStatusChanged { jobId currentStatus cluster } }`,
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

// mockMetricSource implements flink.MetricRatesSource for the metricStream
// resolver tests.
type mockMetricSource struct {
	mu    sync.Mutex
	jobs  []flink.JobOverview
	rates map[string]*flink.JobDetailAggregate
}

func (m *mockMetricSource) GetJobs(_ context.Context) (*flink.JobsOverview, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]flink.JobOverview, len(m.jobs))
	copy(out, m.jobs)
	return &flink.JobsOverview{Jobs: out}, nil
}

func (m *mockMetricSource) GetJobRates(_ context.Context, jobID string) (*flink.JobDetailAggregate, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.rates[jobID], nil
}

func (m *mockMetricSource) setJobs(jobs []flink.JobOverview) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.jobs = jobs
}

func (m *mockMetricSource) setRates(jobID string, agg *flink.JobDetailAggregate) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.rates == nil {
		m.rates = make(map[string]*flink.JobDetailAggregate)
	}
	m.rates[jobID] = agg
}

// metricFixture builds a sampler aggregate where the single source vertex
// emits `rate` records/sec — matches the fixture in metric_sampler_test.go.
func metricFixture(rate float64) *flink.JobDetailAggregate {
	return &flink.JobDetailAggregate{
		Job: &flink.JobDetail{
			Plan: flink.JobPlan{Nodes: []flink.PlanNode{{ID: "src", Inputs: nil}}},
		},
		VertexRates: map[string][]flink.AggregatedSubtaskMetric{
			"src": {{ID: "numRecordsOutPerSecond", Sum: rate}},
		},
	}
}

func TestSubscription_MetricStream_ClusterWide(t *testing.T) {
	src := &mockMetricSource{}
	src.setJobs([]flink.JobOverview{{JID: "j1", Name: "job1", State: "RUNNING"}})
	src.setRates("j1", metricFixture(42))

	sampler := flink.NewMetricSampler(
		"cluster-0",
		src,
		flink.WithMetricSamplerInterval(40*time.Millisecond),
	)
	defer sampler.Stop()

	manager := cluster.NewTestManagerWithMetricSampler("cluster-0", sampler)
	srv := newTestServer(&graphql.Resolver{Manager: manager})
	defer srv.Close()

	conn := wsConnect(t, srv.URL)
	defer func() { _ = conn.Close() }()

	payload, _ := json.Marshal(map[string]any{
		"query":     `subscription M($c: String!) { metricStream(clusterID: $c, metric: "throughput") { clusterID jobId metric value } }`,
		"variables": map[string]any{"c": "cluster-0"},
	})
	writeMsg(t, conn, wsMessage{ID: "1", Type: "subscribe", Payload: payload})

	// Read up to several events; assert that we eventually see the
	// cluster-wide event (jobId == null, value == 42).
	deadline := time.After(2 * time.Second)
	for {
		select {
		case <-deadline:
			t.Fatal("did not observe cluster-wide event within timeout")
		default:
		}

		msg := readMsg(t, conn, time.Second)
		if msg.Type != "next" {
			continue
		}
		var result struct {
			Data struct {
				MetricStream struct {
					ClusterID string  `json:"clusterID"`
					JobID     *string `json:"jobId"`
					Metric    string  `json:"metric"`
					Value     float64 `json:"value"`
				} `json:"metricStream"`
			} `json:"data"`
		}
		if err := json.Unmarshal(msg.Payload, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		evt := result.Data.MetricStream
		if evt.JobID == nil && evt.Metric == "throughput" && evt.Value == 42 && evt.ClusterID == "cluster-0" {
			return
		}
	}
}

func TestSubscription_MetricStream_PerJobFilter(t *testing.T) {
	src := &mockMetricSource{}
	src.setJobs([]flink.JobOverview{
		{JID: "j1", State: "RUNNING"},
		{JID: "j2", State: "RUNNING"},
	})
	src.setRates("j1", metricFixture(10))
	src.setRates("j2", metricFixture(20))

	sampler := flink.NewMetricSampler(
		"cluster-0",
		src,
		flink.WithMetricSamplerInterval(40*time.Millisecond),
	)
	defer sampler.Stop()

	manager := cluster.NewTestManagerWithMetricSampler("cluster-0", sampler)
	srv := newTestServer(&graphql.Resolver{Manager: manager})
	defer srv.Close()

	conn := wsConnect(t, srv.URL)
	defer func() { _ = conn.Close() }()

	payload, _ := json.Marshal(map[string]any{
		"query": `subscription { metricStream(clusterID: "cluster-0", metric: "throughput", jobId: "j2") { jobId value } }`,
	})
	writeMsg(t, conn, wsMessage{ID: "1", Type: "subscribe", Payload: payload})

	// Every event the client sees must be for j2.
	deadline := time.After(2 * time.Second)
	sawJ2 := false
	for {
		select {
		case <-deadline:
			if !sawJ2 {
				t.Fatal("did not observe any j2 event within timeout")
			}
			return
		default:
		}

		msg := readMsg(t, conn, time.Second)
		if msg.Type != "next" {
			continue
		}
		var result struct {
			Data struct {
				MetricStream struct {
					JobID *string `json:"jobId"`
					Value float64 `json:"value"`
				} `json:"metricStream"`
			} `json:"data"`
		}
		_ = json.Unmarshal(msg.Payload, &result)
		evt := result.Data.MetricStream
		if evt.JobID == nil {
			t.Fatalf("expected jobId=j2 only; got cluster-wide event")
		}
		if *evt.JobID != "j2" {
			t.Fatalf("expected jobId=j2, got %q", *evt.JobID)
		}
		if evt.Value != 20 {
			t.Fatalf("expected j2 value=20, got %f", evt.Value)
		}
		sawJ2 = true
	}
}

func TestSubscription_MetricStream_UnknownMetricRejected(t *testing.T) {
	src := &mockMetricSource{}
	src.setJobs(nil)

	sampler := flink.NewMetricSampler("cluster-0", src)
	defer sampler.Stop()

	manager := cluster.NewTestManagerWithMetricSampler("cluster-0", sampler)
	srv := newTestServer(&graphql.Resolver{Manager: manager})
	defer srv.Close()

	conn := wsConnect(t, srv.URL)
	defer func() { _ = conn.Close() }()

	payload, _ := json.Marshal(map[string]any{
		"query": `subscription { metricStream(clusterID: "cluster-0", metric: "bogus") { value } }`,
	})
	writeMsg(t, conn, wsMessage{ID: "1", Type: "subscribe", Payload: payload})

	// We expect an "error" or "next" with errors. The sampler should not have
	// started — its subscriber count stays 0.
	msg := readMsg(t, conn, 2*time.Second)
	if msg.Type != "error" && msg.Type != "next" {
		t.Fatalf("expected error or next-with-error, got %s", msg.Type)
	}
	// Give the resolver a moment in case it briefly subscribed before the
	// validation error propagates.
	time.Sleep(100 * time.Millisecond)
	if got := sampler.SubscriberCount(); got != 0 {
		t.Errorf("expected 0 sampler subscribers for unknown-metric subscription, got %d", got)
	}
}

func TestSubscription_MetricStream_ClientDisconnectCleanup(t *testing.T) {
	src := &mockMetricSource{}
	src.setJobs([]flink.JobOverview{{JID: "j1", State: "RUNNING"}})
	src.setRates("j1", metricFixture(1))

	sampler := flink.NewMetricSampler(
		"cluster-0",
		src,
		flink.WithMetricSamplerInterval(30*time.Millisecond),
	)
	defer sampler.Stop()

	manager := cluster.NewTestManagerWithMetricSampler("cluster-0", sampler)
	srv := newTestServer(&graphql.Resolver{Manager: manager})
	defer srv.Close()

	conn := wsConnect(t, srv.URL)

	payload, _ := json.Marshal(map[string]any{
		"query": `subscription { metricStream(clusterID: "cluster-0", metric: "throughput") { value } }`,
	})
	writeMsg(t, conn, wsMessage{ID: "1", Type: "subscribe", Payload: payload})

	// Let the resolver register with the sampler.
	time.Sleep(100 * time.Millisecond)
	if got := sampler.SubscriberCount(); got != 1 {
		t.Fatalf("expected 1 sampler subscriber, got %d", got)
	}

	_ = conn.Close()

	// Allow the resolver goroutine to observe the context cancel and
	// release the sampler listener.
	time.Sleep(200 * time.Millisecond)
	if got := sampler.SubscriberCount(); got != 0 {
		t.Errorf("expected 0 sampler subscribers after client disconnect, got %d", got)
	}
}
