package graphql_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/sandboxws/flink-reactor-console/server/internal/graphql"
	"github.com/sandboxws/flink-reactor-console/server/internal/graphql/generated"
)

// Executable-schema round-trips proving the new seed/preview arguments parse
// and reach the resolvers. With no instrument registry configured the
// resolvers fail with a known message — anything else (validation error,
// unknown argument, enum mismatch) means the schema and resolver wiring drifted.

// execGraphQL returns the HTTP status and response body. Resolver errors come
// back as 200 with an errors array; request validation failures (bad enum,
// unknown argument) come back as 422.
func execGraphQL(t *testing.T, query string) (int, string) {
	t.Helper()
	srv := handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{
		Resolvers: &graphql.Resolver{},
	}))

	body, _ := json.Marshal(map[string]string{"query": query})
	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	return rec.Code, rec.Body.String()
}

func TestSeedKafkaTopicsArgumentsParse(t *testing.T) {
	status, body := execGraphQL(t, `mutation {
		seedKafkaTopics(
			instrument: "local",
			allTopics: true,
			dryRun: true,
			skipNonEmpty: false,
			domains: ["ecommerce", "iot"]
		) {
			dryRun
			recordsProduced
			topics { topic domain existed existingRecords created skipped recordsProduced error }
		}
	}`)
	if status != http.StatusOK {
		t.Fatalf("arguments failed request validation (%d): %s", status, body)
	}
	if !strings.Contains(body, "instruments not configured") {
		t.Fatalf("expected the instruments-not-configured resolver error, got: %s", body)
	}
}

func TestKafkaTopicMessagesOrderArgumentParses(t *testing.T) {
	status, body := execGraphQL(t, `query {
		kafkaTopicMessages(instrument: "local", topic: "t", limit: 5, order: OLDEST) {
			partition offset timestamp value
		}
	}`)
	if status != http.StatusOK {
		t.Fatalf("order argument failed request validation (%d): %s", status, body)
	}
	if !strings.Contains(body, "instruments not configured") {
		t.Fatalf("expected the instruments-not-configured resolver error, got: %s", body)
	}
}

func TestKafkaTopicMessagesRejectsInvalidOrder(t *testing.T) {
	status, body := execGraphQL(t, `query {
		kafkaTopicMessages(instrument: "local", topic: "t", order: SIDEWAYS) { offset }
	}`)
	if status == http.StatusOK {
		t.Fatalf("expected request validation to reject the enum value, got 200: %s", body)
	}
	if !strings.Contains(body, "SIDEWAYS") {
		t.Fatalf("expected an enum validation error naming the bad value, got: %s", body)
	}
}
