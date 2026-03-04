package graphql_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/generated"
)

func TestHealthQuery(t *testing.T) {
	srv := handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{
		Resolvers: &graphql.Resolver{},
	}))

	body, _ := json.Marshal(map[string]string{
		"query": "{ health }",
	})

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var resp struct {
		Data struct {
			Health bool `json:"health"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v\nbody: %s", err, rec.Body.String())
	}

	if !resp.Data.Health {
		t.Error("expected health to be true")
	}
}
