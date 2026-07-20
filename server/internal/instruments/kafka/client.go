// Package kafka implements the Kafka instrument for topic and consumer group browsing.
package kafka

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/twmb/franz-go/pkg/kadm"
	"github.com/twmb/franz-go/pkg/kerr"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl/plain"
	"github.com/twmb/franz-go/pkg/sasl/scram"

	"github.com/sandboxws/flink-reactor-console/server/internal/instruments/kafka/seed"
)

// Topic is a summary of a Kafka topic.
type Topic struct {
	Name              string
	PartitionCount    int
	ReplicationFactor int
	Internal          bool
}

// TopicDetail is detailed information about a Kafka topic.
type TopicDetail struct {
	Name              string
	PartitionCount    int
	ReplicationFactor int
	Internal          bool
	Partitions        []Partition
	ConfigEntries     []ConfigEntry
	MessageCount      int64
}

// Partition describes a single partition of a topic.
type Partition struct {
	ID             int32
	Leader         int32
	Replicas       []int32
	InSyncReplicas []int32
}

// ConfigEntry is a key-value config pair.
type ConfigEntry struct {
	Key   string
	Value string
}

// ConsumerGroup is a summary of a Kafka consumer group.
type ConsumerGroup struct {
	GroupID     string
	State       string
	MemberCount int
	TotalLag    int64
}

// ConsumerGroupDetail is detailed information about a consumer group.
type ConsumerGroupDetail struct {
	GroupID      string
	State        string
	Protocol     string
	ProtocolType string
	Members      []GroupMember
	Offsets      []PartitionOffset
}

// GroupMember is a member of a consumer group.
type GroupMember struct {
	ClientID    string
	ClientHost  string
	Assignments []TopicPartition
}

// TopicPartition is a topic-partition pair.
type TopicPartition struct {
	Topic     string
	Partition int32
}

// PartitionOffset tracks committed/end offsets and lag for a partition.
type PartitionOffset struct {
	Topic           string
	Partition       int32
	CommittedOffset int64
	EndOffset       int64
	Lag             int64
}

// SeededTopic is the per-topic outcome of a seed operation. Existed and
// ExistingRecords come from the upfront broker consultation, so dry and real
// runs report the same plan.
type SeededTopic struct {
	Topic           string
	Domain          string
	Existed         bool
	ExistingRecords int64
	Created         bool
	Skipped         bool
	RecordsProduced int
	// Error is the per-topic failure message; empty when the topic seeded
	// cleanly. Seeding is best-effort per topic.
	Error string
}

// SeedResult summarizes a Seed call.
type SeedResult struct {
	Topics          []SeededTopic
	RecordsProduced int
	Skipped         []string
	DryRun          bool
}

// SeedOptions configures a Seed call.
type SeedOptions struct {
	// DryRun reports what would happen without creating topics or producing.
	DryRun bool
	// SkipNonEmpty skips subjects whose topic already holds records, making
	// re-seeding idempotent (parity with `cluster up`'s guard).
	SkipNonEmpty bool
}

// Message is a single Kafka record returned by a preview read.
type Message struct {
	Partition   int32
	Offset      int64
	TimestampMs int64
	Key         string
	Value       string
}

// ClientOption configures the Kafka client.
type ClientOption func(*clientOptions)

type clientOptions struct {
	saslMechanism string
	saslUsername  string
	saslPassword  string
	tlsEnabled    bool
	tlsCACert     string
	tlsClientCert string
	tlsClientKey  string
}

// WithSASL configures SASL authentication.
func WithSASL(mechanism, username, password string) ClientOption {
	return func(o *clientOptions) {
		o.saslMechanism = mechanism
		o.saslUsername = username
		o.saslPassword = password
	}
}

// WithTLS enables TLS with optional mTLS certificates.
func WithTLS(caCert, clientCert, clientKey string) ClientOption {
	return func(o *clientOptions) {
		o.tlsEnabled = true
		o.tlsCACert = caCert
		o.tlsClientCert = clientCert
		o.tlsClientKey = clientKey
	}
}

// Client wraps franz-go/kadm for Kafka admin operations.
type Client struct {
	cl  *kgo.Client
	adm *kadm.Client
	// baseOpts are the seed-broker + SASL + TLS options used to build cl. A
	// throwaway preview consumer reuses them so it inherits the same auth.
	baseOpts []kgo.Opt
}

// NewClient creates a Kafka admin client connected to the given brokers.
func NewClient(brokers []string, opts ...ClientOption) (*Client, error) {
	var o clientOptions
	for _, opt := range opts {
		opt(&o)
	}

	kgoOpts := []kgo.Opt{
		kgo.SeedBrokers(brokers...),
	}

	// SASL configuration.
	if o.saslMechanism != "" {
		switch o.saslMechanism {
		case "PLAIN":
			kgoOpts = append(kgoOpts, kgo.SASL(plain.Auth{
				User: o.saslUsername,
				Pass: o.saslPassword,
			}.AsMechanism()))
		case "SCRAM-SHA-256":
			kgoOpts = append(kgoOpts, kgo.SASL(scram.Auth{
				User: o.saslUsername,
				Pass: o.saslPassword,
			}.AsSha256Mechanism()))
		case "SCRAM-SHA-512":
			kgoOpts = append(kgoOpts, kgo.SASL(scram.Auth{
				User: o.saslUsername,
				Pass: o.saslPassword,
			}.AsSha512Mechanism()))
		default:
			return nil, fmt.Errorf("unsupported SASL mechanism: %s", o.saslMechanism)
		}
	}

	// TLS configuration.
	if o.tlsEnabled {
		tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}

		if o.tlsCACert != "" {
			pool := x509.NewCertPool()
			if !pool.AppendCertsFromPEM([]byte(o.tlsCACert)) {
				return nil, fmt.Errorf("failed to parse CA certificate")
			}
			tlsCfg.RootCAs = pool
		}

		if o.tlsClientCert != "" && o.tlsClientKey != "" {
			cert, err := tls.X509KeyPair([]byte(o.tlsClientCert), []byte(o.tlsClientKey))
			if err != nil {
				return nil, fmt.Errorf("failed to parse client certificate: %w", err)
			}
			tlsCfg.Certificates = []tls.Certificate{cert}
		}

		kgoOpts = append(kgoOpts, kgo.DialTLSConfig(tlsCfg))
	}

	cl, err := kgo.NewClient(kgoOpts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create kafka client: %w", err)
	}

	return &Client{
		cl:       cl,
		adm:      kadm.NewClient(cl),
		baseOpts: kgoOpts,
	}, nil
}

// Close disconnects the Kafka client.
func (c *Client) Close() {
	c.cl.Close()
}

// Ping verifies broker connectivity by requesting metadata.
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.adm.BrokerMetadata(ctx)
	if err != nil {
		return fmt.Errorf("kafka ping failed: %w", err)
	}
	return nil
}

// EnsureTopic creates the topic with a single partition and replication factor 1
// (the local single-broker default). It reports whether the topic was created; an
// already-existing topic is not an error.
func (c *Client) EnsureTopic(ctx context.Context, name string) (bool, error) {
	resp, err := c.adm.CreateTopics(ctx, 1, 1, nil, name)
	if err != nil {
		return false, fmt.Errorf("create topic %q failed: %w", name, err)
	}
	r, ok := resp[name]
	if !ok {
		return true, nil
	}
	if r.Err != nil {
		if errors.Is(r.Err, kerr.TopicAlreadyExists) {
			return false, nil
		}
		return false, fmt.Errorf("create topic %q failed: %w", name, r.Err)
	}
	return true, nil
}

// ProduceRecords synchronously produces the given JSON values to a topic and
// returns the number of records written.
func (c *Client) ProduceRecords(ctx context.Context, topic string, values [][]byte) (int, error) {
	if len(values) == 0 {
		return 0, nil
	}
	records := make([]*kgo.Record, 0, len(values))
	for _, v := range values {
		records = append(records, &kgo.Record{Topic: topic, Value: v})
	}
	if err := c.cl.ProduceSync(ctx, records...).FirstErr(); err != nil {
		return 0, fmt.Errorf("produce to %q failed: %w", topic, err)
	}
	return len(records), nil
}

// Seed produces each subject's sample rows into its topic, best-effort per
// topic. One upfront batched broker consultation (topic existence + current
// record counts) feeds every row's Existed/ExistingRecords, so dry and real
// runs report identical plans: what would be created, what already holds
// records, what gets skipped under opts.SkipNonEmpty. A per-topic failure is
// recorded on the row's Error without aborting the remaining topics; only a
// failed consultation is a hard error. Subjects with no sample rows are
// reported in Skipped names only (no per-topic row).
func (c *Client) Seed(ctx context.Context, subjects []seed.Subject, opts SeedOptions) (*SeedResult, error) {
	res := &SeedResult{DryRun: opts.DryRun}
	if len(subjects) == 0 {
		return res, nil
	}

	names := make([]string, 0, len(subjects))
	for _, s := range subjects {
		names = append(names, s.Topic)
	}
	existing := make(map[string]bool, len(names))
	counts := make(map[string]int64, len(names))
	details, err := c.adm.ListTopics(ctx, names...)
	if err != nil {
		return nil, fmt.Errorf("list topics failed: %w", err)
	}
	present := make([]string, 0, len(names))
	for _, td := range details.Sorted() {
		if td.Err != nil {
			continue
		}
		existing[td.Topic] = true
		present = append(present, td.Topic)
	}
	if len(present) > 0 {
		ends, err := c.adm.ListEndOffsets(ctx, present...)
		if err != nil {
			return nil, fmt.Errorf("list end offsets failed: %w", err)
		}
		starts, err := c.adm.ListStartOffsets(ctx, present...)
		if err != nil {
			return nil, fmt.Errorf("list start offsets failed: %w", err)
		}
		ends.Each(func(o kadm.ListedOffset) {
			if o.Err != nil {
				return
			}
			start := int64(0)
			if so, ok := starts.Lookup(o.Topic, o.Partition); ok {
				start = so.Offset
			}
			counts[o.Topic] += o.Offset - start
		})
	}

	for _, s := range subjects {
		values := make([][]byte, 0, len(s.SampleRows))
		for _, row := range s.SampleRows {
			values = append(values, []byte(row))
		}
		if len(values) == 0 {
			res.Skipped = append(res.Skipped, s.Topic)
			continue
		}

		t := SeededTopic{
			Topic:           s.Topic,
			Domain:          s.Domain,
			Existed:         existing[s.Topic],
			ExistingRecords: counts[s.Topic],
		}

		if opts.SkipNonEmpty && t.ExistingRecords > 0 {
			t.Skipped = true
			res.Topics = append(res.Topics, t)
			res.Skipped = append(res.Skipped, s.Topic)
			continue
		}

		if opts.DryRun {
			t.Created = !t.Existed
			t.RecordsProduced = len(values)
			res.Topics = append(res.Topics, t)
			res.RecordsProduced += len(values)
			continue
		}

		created, err := c.EnsureTopic(ctx, s.Topic)
		if err != nil {
			t.Error = err.Error()
			res.Topics = append(res.Topics, t)
			continue
		}
		t.Created = created
		n, err := c.ProduceRecords(ctx, s.Topic, values)
		if err != nil {
			t.Error = err.Error()
			res.Topics = append(res.Topics, t)
			continue
		}
		t.RecordsProduced = n
		res.Topics = append(res.Topics, t)
		res.RecordsProduced += n
	}
	return res, nil
}

// PreviewMessages reads up to limit records from a topic using a throwaway
// direct-partition consumer (no consumer group, so nothing is left behind in
// the group listing). It captures each partition's [start,end) offsets, then
// seeks per oldestFirst: false tails the stream (seek end−N, newest records
// first — the live end); true reads from the earliest retained offsets
// (oldest first — where the deterministic seed rows live). Best-effort under
// a short deadline: a partition whose target offset never arrives
// (compaction, gaps) simply contributes what it had.
func (c *Client) PreviewMessages(ctx context.Context, topic string, limit int, oldestFirst bool) ([]Message, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}

	endOffsets, err := c.adm.ListEndOffsets(ctx, topic)
	if err != nil {
		return nil, fmt.Errorf("list end offsets failed: %w", err)
	}
	startOffsets, err := c.adm.ListStartOffsets(ctx, topic)
	if err != nil {
		return nil, fmt.Errorf("list start offsets failed: %w", err)
	}

	type partRange struct {
		partition  int32
		start, end int64
	}
	var parts []partRange
	endOffsets.Each(func(o kadm.ListedOffset) {
		if o.Err != nil {
			return
		}
		start := int64(0)
		if so, ok := startOffsets.Lookup(o.Topic, o.Partition); ok {
			start = so.Offset
		}
		if o.Offset > start {
			parts = append(parts, partRange{partition: o.Partition, start: start, end: o.Offset})
		}
	})
	if len(parts) == 0 {
		return []Message{}, nil
	}

	// Spread the limit across partitions so each end of the stream is
	// represented, clamping every partition's window to its retained range.
	perPart := (limit + len(parts) - 1) / len(parts)
	offsets := make(map[int32]kgo.Offset, len(parts))
	targets := make(map[int32]int64, len(parts))
	for _, p := range parts {
		var startAt, target int64
		if oldestFirst {
			startAt = p.start
			target = min(p.start+int64(perPart), p.end) - 1
		} else {
			startAt = max(p.end-int64(perPart), p.start)
			target = p.end - 1
		}
		offsets[p.partition] = kgo.NewOffset().At(startAt)
		targets[p.partition] = target
	}

	consumeOpts := make([]kgo.Opt, 0, len(c.baseOpts)+1)
	consumeOpts = append(consumeOpts, c.baseOpts...)
	consumeOpts = append(consumeOpts, kgo.ConsumePartitions(map[string]map[int32]kgo.Offset{topic: offsets}))
	cl, err := kgo.NewClient(consumeOpts...)
	if err != nil {
		return nil, fmt.Errorf("preview consumer init failed: %w", err)
	}
	defer cl.Close()

	pctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var out []Message
	reached := make(map[int32]bool, len(parts))
	collect := func(r *kgo.Record) {
		out = append(out, Message{
			Partition:   r.Partition,
			Offset:      r.Offset,
			TimestampMs: r.Timestamp.UnixMilli(),
			Key:         string(r.Key),
			Value:       string(r.Value),
		})
		if r.Offset >= targets[r.Partition] {
			reached[r.Partition] = true
		}
	}
	allReached := func() bool {
		for _, p := range parts {
			if !reached[p.partition] {
				return false
			}
		}
		return true
	}

	for pctx.Err() == nil {
		fetches := cl.PollFetches(pctx)
		if pctx.Err() != nil {
			fetches.EachRecord(collect)
			break
		}
		if errs := fetches.Errors(); len(errs) > 0 {
			return nil, fmt.Errorf("preview fetch failed: %w", errs[0].Err)
		}
		fetches.EachRecord(collect)
		if allReached() {
			break
		}
	}

	// Requested order, capped to limit.
	sort.Slice(out, func(i, j int) bool {
		if oldestFirst {
			if out[i].TimestampMs != out[j].TimestampMs {
				return out[i].TimestampMs < out[j].TimestampMs
			}
			return out[i].Offset < out[j].Offset
		}
		if out[i].TimestampMs != out[j].TimestampMs {
			return out[i].TimestampMs > out[j].TimestampMs
		}
		return out[i].Offset > out[j].Offset
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

// TopicNames returns a list of all topic names (for highlight matching).
func (c *Client) TopicNames(ctx context.Context) ([]string, error) {
	topics, err := c.adm.ListTopics(ctx)
	if err != nil {
		return nil, fmt.Errorf("list topics failed: %w", err)
	}
	names := make([]string, 0, len(topics))
	for _, t := range topics.Sorted() {
		names = append(names, t.Topic)
	}
	return names, nil
}

// ListTopics returns a summary of all topics.
func (c *Client) ListTopics(ctx context.Context) ([]Topic, error) {
	topics, err := c.adm.ListTopics(ctx)
	if err != nil {
		return nil, fmt.Errorf("list topics failed: %w", err)
	}

	result := make([]Topic, 0, len(topics))
	for _, t := range topics.Sorted() {
		rf := 0
		if len(t.Partitions) > 0 {
			rf = len(t.Partitions[0].Replicas)
		}
		result = append(result, Topic{
			Name:              t.Topic,
			PartitionCount:    len(t.Partitions),
			ReplicationFactor: rf,
			Internal:          t.IsInternal,
		})
	}
	return result, nil
}

// GetTopicDetail returns detailed information about a specific topic.
func (c *Client) GetTopicDetail(ctx context.Context, name string) (*TopicDetail, error) {
	topics, err := c.adm.ListTopics(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("describe topic failed: %w", err)
	}

	t, ok := topics[name]
	if !ok {
		return nil, fmt.Errorf("topic %q not found", name)
	}

	rf := 0
	partitions := make([]Partition, 0, len(t.Partitions))
	for _, p := range t.Partitions.Sorted() {
		if rf == 0 {
			rf = len(p.Replicas)
		}
		partitions = append(partitions, Partition{
			ID:             p.Partition,
			Leader:         p.Leader,
			Replicas:       p.Replicas,
			InSyncReplicas: p.ISR,
		})
	}

	// Get topic config.
	configs, err := c.adm.DescribeTopicConfigs(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("describe topic configs failed: %w", err)
	}

	var configEntries []ConfigEntry
	for _, rc := range configs {
		if rc.Err != nil {
			continue
		}
		for _, entry := range rc.Configs {
			if entry.Value != nil {
				configEntries = append(configEntries, ConfigEntry{
					Key:   entry.Key,
					Value: *entry.Value,
				})
			}
		}
	}
	sort.Slice(configEntries, func(i, j int) bool {
		return configEntries[i].Key < configEntries[j].Key
	})

	// Estimate message count from end offsets.
	var messageCount int64
	endOffsets, err := c.adm.ListEndOffsets(ctx, name)
	if err == nil {
		endOffsets.Each(func(o kadm.ListedOffset) {
			if o.Offset > 0 {
				messageCount += o.Offset
			}
		})
	}

	return &TopicDetail{
		Name:              t.Topic,
		PartitionCount:    len(t.Partitions),
		ReplicationFactor: rf,
		Internal:          t.IsInternal,
		Partitions:        partitions,
		ConfigEntries:     configEntries,
		MessageCount:      messageCount,
	}, nil
}

// ListConsumerGroups returns a summary of all consumer groups with lag.
func (c *Client) ListConsumerGroups(ctx context.Context) ([]ConsumerGroup, error) {
	groups, err := c.adm.DescribeGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("describe groups failed: %w", err)
	}

	// Collect group names for lag calculation.
	groupNames := make([]string, 0, len(groups))
	for _, g := range groups.Sorted() {
		groupNames = append(groupNames, g.Group)
	}

	// Calculate lag for all groups in one call.
	lags, _ := c.adm.Lag(ctx, groupNames...)

	result := make([]ConsumerGroup, 0, len(groups))
	for _, g := range groups.Sorted() {
		cg := ConsumerGroup{
			GroupID:     g.Group,
			State:       g.State,
			MemberCount: len(g.Members),
		}

		if gl, ok := lags[g.Group]; ok && gl.Error() == nil {
			cg.TotalLag = gl.Lag.Total()
		}

		result = append(result, cg)
	}
	return result, nil
}

// GetConsumerGroupDetail returns detailed information about a consumer group.
func (c *Client) GetConsumerGroupDetail(ctx context.Context, groupID string) (*ConsumerGroupDetail, error) {
	groups, err := c.adm.DescribeGroups(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("describe group failed: %w", err)
	}

	g, ok := groups[groupID]
	if !ok {
		return nil, fmt.Errorf("consumer group %q not found", groupID)
	}
	if g.Err != nil {
		return nil, fmt.Errorf("consumer group %q error: %w", groupID, g.Err)
	}

	members := make([]GroupMember, 0, len(g.Members))
	for _, m := range g.Members {
		gm := GroupMember{
			ClientID:   m.ClientID,
			ClientHost: m.ClientHost,
		}

		if consumer, ok := m.Assigned.AsConsumer(); ok && consumer != nil {
			for _, topic := range consumer.Topics {
				for _, p := range topic.Partitions {
					gm.Assignments = append(gm.Assignments, TopicPartition{
						Topic:     topic.Topic,
						Partition: p,
					})
				}
			}
		}

		members = append(members, gm)
	}

	// Get committed offsets and end offsets for lag calculation.
	committed, err := c.adm.FetchOffsets(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("fetch offsets failed: %w", err)
	}

	var offsets []PartitionOffset
	// Collect all topics from committed offsets.
	var topics []string
	committed.Each(func(o kadm.OffsetResponse) {
		topics = append(topics, o.Topic)
	})

	if len(topics) > 0 {
		endOffsets, err := c.adm.ListEndOffsets(ctx, topics...)
		if err == nil {
			committed.Each(func(co kadm.OffsetResponse) {
				endOff, _ := endOffsets.Lookup(co.Topic, co.Partition)
				lag := endOff.Offset - co.At
				if lag < 0 {
					lag = 0
				}
				offsets = append(offsets, PartitionOffset{
					Topic:           co.Topic,
					Partition:       co.Partition,
					CommittedOffset: co.At,
					EndOffset:       endOff.Offset,
					Lag:             lag,
				})
			})
		}
	}

	sort.Slice(offsets, func(i, j int) bool {
		if offsets[i].Topic != offsets[j].Topic {
			return offsets[i].Topic < offsets[j].Topic
		}
		return offsets[i].Partition < offsets[j].Partition
	})

	return &ConsumerGroupDetail{
		GroupID:      g.Group,
		State:        g.State,
		Protocol:     g.Protocol,
		ProtocolType: g.ProtocolType,
		Members:      members,
		Offsets:      offsets,
	}, nil
}
