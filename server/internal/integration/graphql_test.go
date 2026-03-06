package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestIntegration_QueryJobs(t *testing.T) {
	t.Parallel()
	ts := newTestServer(t)

	resp := graphqlQuery(t, ts.Server.Echo(), `{ jobs { id name state } }`)
	if len(resp.Errors) > 0 {
		t.Fatalf("unexpected errors: %v", resp.Errors)
	}

	var data struct {
		Jobs []struct {
			ID    string `json:"id"`
			Name  string `json:"name"`
			State string `json:"state"`
		} `json:"jobs"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// MockJobsOverview returns 6 jobs.
	if len(data.Jobs) != 6 {
		t.Errorf("expected 6 jobs, got %d", len(data.Jobs))
	}
	if data.Jobs[0].ID == "" {
		t.Error("expected non-empty job ID")
	}
}

func TestIntegration_QueryJobDetail(t *testing.T) {
	t.Parallel()
	ts := newTestServer(t)

	resp := graphqlQuery(t, ts.Server.Echo(),
		`query($id: ID!) { job(id: $id) { id name state vertices { id name } } }`,
		map[string]any{"id": "d1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"},
	)
	if len(resp.Errors) > 0 {
		t.Fatalf("unexpected errors: %v", resp.Errors)
	}

	var data struct {
		Job struct {
			ID       string `json:"id"`
			Name     string `json:"name"`
			State    string `json:"state"`
			Vertices []struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"vertices"`
		} `json:"job"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if data.Job.ID == "" {
		t.Error("expected non-empty job ID")
	}
	if len(data.Job.Vertices) == 0 {
		t.Error("expected at least one vertex")
	}
}

func TestIntegration_QueryFlinkConfig(t *testing.T) {
	t.Parallel()
	ts := newTestServer(t)

	resp := graphqlQuery(t, ts.Server.Echo(), `{ flinkConfig { flinkVersion } }`)
	if len(resp.Errors) > 0 {
		t.Fatalf("unexpected errors: %v", resp.Errors)
	}

	var data struct {
		FlinkConfig struct {
			FlinkVersion string `json:"flinkVersion"`
		} `json:"flinkConfig"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if data.FlinkConfig.FlinkVersion != "1.20.0" {
		t.Errorf("expected Flink version '1.20.0', got %q", data.FlinkConfig.FlinkVersion)
	}
}

func TestIntegration_QueryTaskManagers(t *testing.T) {
	t.Parallel()
	ts := newTestServer(t)

	resp := graphqlQuery(t, ts.Server.Echo(), `{ taskManagers { id path dataPort } }`)
	if len(resp.Errors) > 0 {
		t.Fatalf("unexpected errors: %v", resp.Errors)
	}

	var data struct {
		TaskManagers []struct {
			ID       string `json:"id"`
			Path     string `json:"path"`
			DataPort int    `json:"dataPort"`
		} `json:"taskManagers"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(data.TaskManagers) != 4 {
		t.Errorf("expected 4 task managers, got %d", len(data.TaskManagers))
	}
}

func TestIntegration_RequestIDPropagation(t *testing.T) {
	t.Parallel()
	ts := newTestServer(t)

	body := `{"query": "{ health }"}`
	req := httptest.NewRequest(http.MethodPost, "/graphql", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Request-Id", "test-request-123")

	rec := httptest.NewRecorder()
	ts.Server.Echo().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	gotID := rec.Header().Get("X-Request-Id")
	if gotID != "test-request-123" {
		t.Errorf("expected X-Request-Id 'test-request-123', got %q", gotID)
	}
}
