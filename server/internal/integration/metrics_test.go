package integration

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
)

func TestIntegration_MetricsEndpoint(t *testing.T) {
	// Register metrics (idempotent within test process).
	observability.RegisterMetrics()

	ts := newTestServer(t)

	// Send a GraphQL request to generate metrics.
	graphqlQuery(t, ts.Server.Echo(), `{ health }`)

	// Now query the /metrics endpoint.
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rec := httptest.NewRecorder()
	ts.Server.Echo().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	body := rec.Body.String()

	// Verify key metric names appear in the Prometheus exposition format.
	expectedMetrics := []string{
		"reactor_http_requests_total",
		"reactor_http_request_duration_seconds",
		"reactor_graphql_resolver_duration_seconds",
	}
	for _, metric := range expectedMetrics {
		if !strings.Contains(body, metric) {
			t.Errorf("expected /metrics to contain %q", metric)
		}
	}
}
