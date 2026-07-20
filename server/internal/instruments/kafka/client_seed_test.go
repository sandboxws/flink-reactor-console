package kafka_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/twmb/franz-go/pkg/kfake"

	"github.com/sandboxws/flink-reactor-console/server/internal/instruments/kafka"
	"github.com/sandboxws/flink-reactor-console/server/internal/instruments/kafka/seed"
)

// Seed and PreviewMessages are exercised against an in-process kfake cluster —
// no real broker, no Docker. Each test gets a fresh single-broker cluster.

func newTestClient(t *testing.T) (*kfake.Cluster, *kafka.Client) {
	t.Helper()
	cluster, err := kfake.NewCluster(kfake.NumBrokers(1))
	if err != nil {
		t.Fatalf("kfake cluster: %v", err)
	}
	t.Cleanup(cluster.Close)

	client, err := kafka.NewClient(cluster.ListenAddrs())
	if err != nil {
		t.Fatalf("kafka client: %v", err)
	}
	t.Cleanup(client.Close)
	return cluster, client
}

func testCtx(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancel)
	return ctx
}

func subject(topic, domain string, rows ...string) seed.Subject {
	raws := make([]json.RawMessage, len(rows))
	for i, r := range rows {
		raws[i] = json.RawMessage(r)
	}
	return seed.Subject{Topic: topic, Domain: domain, SampleRows: raws}
}

func topicRow(t *testing.T, res *kafka.SeedResult, topic string) kafka.SeededTopic {
	t.Helper()
	for _, row := range res.Topics {
		if row.Topic == topic {
			return row
		}
	}
	t.Fatalf("no per-topic row for %q in %+v", topic, res.Topics)
	return kafka.SeededTopic{}
}

func TestSeedCreatesProducesAndSkipsOnRerun(t *testing.T) {
	_, client := newTestClient(t)
	ctx := testCtx(t)

	subjects := []seed.Subject{
		subject("ecom.orders", "ecommerce", `{"id":1}`, `{"id":2}`),
		subject("page-views", "analytics", `{"u":"a"}`),
	}

	res, err := client.Seed(ctx, subjects, kafka.SeedOptions{SkipNonEmpty: true})
	if err != nil {
		t.Fatalf("first seed: %v", err)
	}
	if res.RecordsProduced != 3 {
		t.Fatalf("expected 3 records produced, got %d", res.RecordsProduced)
	}
	orders := topicRow(t, res, "ecom.orders")
	if orders.Existed || !orders.Created || orders.ExistingRecords != 0 || orders.RecordsProduced != 2 {
		t.Fatalf("unexpected first-run row: %+v", orders)
	}

	// Re-running with SkipNonEmpty must be a no-op that reports the skip —
	// the idempotency contract shared with `cluster up`.
	again, err := client.Seed(ctx, subjects, kafka.SeedOptions{SkipNonEmpty: true})
	if err != nil {
		t.Fatalf("second seed: %v", err)
	}
	if again.RecordsProduced != 0 {
		t.Fatalf("re-seed produced %d records, want 0", again.RecordsProduced)
	}
	reOrders := topicRow(t, again, "ecom.orders")
	if !reOrders.Skipped || !reOrders.Existed || reOrders.ExistingRecords != 2 {
		t.Fatalf("unexpected re-run row: %+v", reOrders)
	}
	if len(again.Skipped) != 2 {
		t.Fatalf("expected both topics in skipped names, got %v", again.Skipped)
	}
}

func TestSeedDryRunConsultsBrokerWithoutWriting(t *testing.T) {
	_, client := newTestClient(t)
	ctx := testCtx(t)

	// Pre-populate one topic so the dry run has real broker state to report.
	if _, err := client.EnsureTopic(ctx, "pre.filled"); err != nil {
		t.Fatalf("ensure: %v", err)
	}
	if _, err := client.ProduceRecords(ctx, "pre.filled", [][]byte{[]byte(`{"x":1}`), []byte(`{"x":2}`)}); err != nil {
		t.Fatalf("produce: %v", err)
	}

	subjects := []seed.Subject{
		subject("pre.filled", "iot", `{"x":3}`),
		subject("fresh.topic", "iot", `{"y":1}`, `{"y":2}`),
	}
	res, err := client.Seed(ctx, subjects, kafka.SeedOptions{DryRun: true, SkipNonEmpty: false})
	if err != nil {
		t.Fatalf("dry run: %v", err)
	}
	if !res.DryRun {
		t.Fatal("result not marked dry-run")
	}

	pre := topicRow(t, res, "pre.filled")
	if !pre.Existed || pre.ExistingRecords != 2 || pre.Created || pre.RecordsProduced != 1 {
		t.Fatalf("unexpected pre-filled dry row: %+v", pre)
	}
	fresh := topicRow(t, res, "fresh.topic")
	if fresh.Existed || !fresh.Created || fresh.RecordsProduced != 2 {
		t.Fatalf("unexpected fresh dry row: %+v", fresh)
	}

	// The dry run must not have created or produced anything.
	topics, err := client.ListTopics(ctx)
	if err != nil {
		t.Fatalf("list topics: %v", err)
	}
	for _, topic := range topics {
		if topic.Name == "fresh.topic" {
			t.Fatal("dry run created a topic")
		}
	}
	detail, err := client.GetTopicDetail(ctx, "pre.filled")
	if err != nil {
		t.Fatalf("detail: %v", err)
	}
	if detail.MessageCount != 2 {
		t.Fatalf("dry run changed message count: %d", detail.MessageCount)
	}
}

func TestSeedSkipNonEmptyFalseAppends(t *testing.T) {
	_, client := newTestClient(t)
	ctx := testCtx(t)

	subjects := []seed.Subject{subject("append.me", "banking", `{"a":1}`)}
	if _, err := client.Seed(ctx, subjects, kafka.SeedOptions{}); err != nil {
		t.Fatalf("first: %v", err)
	}
	res, err := client.Seed(ctx, subjects, kafka.SeedOptions{SkipNonEmpty: false})
	if err != nil {
		t.Fatalf("second: %v", err)
	}
	row := topicRow(t, res, "append.me")
	if row.Skipped || row.RecordsProduced != 1 || row.ExistingRecords != 1 {
		t.Fatalf("expected forced append onto 1 existing record, got %+v", row)
	}
}

func TestSeedNoSampleRowsReportedInSkippedNamesOnly(t *testing.T) {
	_, client := newTestClient(t)
	ctx := testCtx(t)

	res, err := client.Seed(ctx, []seed.Subject{subject("no.rows", "iot")}, kafka.SeedOptions{})
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	if len(res.Topics) != 0 || len(res.Skipped) != 1 || res.Skipped[0] != "no.rows" {
		t.Fatalf("unexpected result for row-less subject: %+v", res)
	}
}

func TestSeedConsultationFailureIsHardError(t *testing.T) {
	cluster, client := newTestClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cluster.Close()
	if _, err := client.Seed(ctx, []seed.Subject{subject("t", "iot", `{"a":1}`)}, kafka.SeedOptions{}); err == nil {
		t.Fatal("expected the upfront broker consultation to fail")
	}
}

func TestPreviewMessagesOldestVsNewest(t *testing.T) {
	_, client := newTestClient(t)
	ctx := testCtx(t)

	if _, err := client.EnsureTopic(ctx, "ordered"); err != nil {
		t.Fatalf("ensure: %v", err)
	}
	values := [][]byte{[]byte(`"r0"`), []byte(`"r1"`), []byte(`"r2"`), []byte(`"r3"`), []byte(`"r4"`)}
	if _, err := client.ProduceRecords(ctx, "ordered", values); err != nil {
		t.Fatalf("produce: %v", err)
	}

	oldest, err := client.PreviewMessages(ctx, "ordered", 2, true)
	if err != nil {
		t.Fatalf("oldest preview: %v", err)
	}
	if len(oldest) != 2 || oldest[0].Offset != 0 || oldest[1].Offset != 1 {
		t.Fatalf("unexpected oldest window: %+v", oldest)
	}

	newest, err := client.PreviewMessages(ctx, "ordered", 2, false)
	if err != nil {
		t.Fatalf("newest preview: %v", err)
	}
	if len(newest) != 2 || newest[0].Offset != 4 || newest[1].Offset != 3 {
		t.Fatalf("unexpected newest window: %+v", newest)
	}
}
