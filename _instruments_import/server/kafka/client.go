// Package kafka implements the Kafka instrument for topic and consumer group browsing.
package kafka

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"sort"

	"github.com/twmb/franz-go/pkg/kadm"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl/plain"
	"github.com/twmb/franz-go/pkg/sasl/scram"
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
		cl:  cl,
		adm: kadm.NewClient(cl),
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
