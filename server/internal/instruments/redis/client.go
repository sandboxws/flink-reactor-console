// Package redis implements the Redis instrument for key browsing and server monitoring.
package redis

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"strconv"
	"strings"

	goredis "github.com/redis/go-redis/v9"
)

// Truncation limits applied when retrieving key values.
const (
	stringValueMaxBytes  = 10 * 1024
	collectionMaxEntries = 100
)

// KeyInfo describes the metadata of a single Redis key.
type KeyInfo struct {
	Key         string
	Type        string
	TTLSeconds  int64
	Encoding    string
	MemoryUsage int64
}

// HashEntry is a single field/value pair from a Redis HASH.
type HashEntry struct {
	Field string
	Value string
}

// ZSetEntry is a single member/score pair from a Redis ZSET.
type ZSetEntry struct {
	Member string
	Score  float64
}

// KeyValue is the type-aware value of a Redis key.
type KeyValue struct {
	Key         string
	Type        string
	StringValue string
	HashValue   []HashEntry
	ListValue   []string
	SetValue    []string
	ZSetValue   []ZSetEntry
	Truncated   bool
	TotalSize   int64
}

// ServerInfo summarises Redis server health and keyspace stats.
type ServerInfo struct {
	Version          string
	UptimeSeconds    int64
	ConnectedClients int64
	UsedMemory       int64
	TotalKeys        int64
	KeyspaceHits     int64
	KeyspaceMisses   int64
}

// MemoryStats captures the parsed `INFO memory` section.
type MemoryStats struct {
	UsedMemory         int64
	PeakMemory         int64
	RSS                int64
	FragmentationRatio float64
	DatasetSize        int64
	Overhead           int64
	Allocator          string
}

// ScanResult is a single batch of keys returned from SCAN.
type ScanResult struct {
	Keys   []string
	Cursor uint64
}

// ClientOption configures the Redis client.
type ClientOption func(*clientOptions)

type clientOptions struct {
	password   string
	db         int
	tlsEnabled bool
	tlsCACert  string
	tlsCert    string
	tlsKey     string
}

// WithPassword sets the AUTH password.
func WithPassword(pw string) ClientOption {
	return func(o *clientOptions) { o.password = pw }
}

// WithDB selects the Redis database number.
func WithDB(db int) ClientOption {
	return func(o *clientOptions) { o.db = db }
}

// WithTLS enables TLS, optionally with a CA cert and client cert/key for mTLS.
func WithTLS(caCert, clientCert, clientKey string) ClientOption {
	return func(o *clientOptions) {
		o.tlsEnabled = true
		o.tlsCACert = caCert
		o.tlsCert = clientCert
		o.tlsKey = clientKey
	}
}

// Client wraps a go-redis client with domain-specific methods.
type Client struct {
	rdb *goredis.Client
}

// NewClient creates a Redis client connected to addr.
func NewClient(addr string, opts ...ClientOption) (*Client, error) {
	var o clientOptions
	for _, opt := range opts {
		opt(&o)
	}

	options := &goredis.Options{
		Addr:     addr,
		Password: o.password,
		DB:       o.db,
	}

	if o.tlsEnabled {
		tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}

		if o.tlsCACert != "" {
			pool := x509.NewCertPool()
			if !pool.AppendCertsFromPEM([]byte(o.tlsCACert)) {
				return nil, fmt.Errorf("failed to parse CA certificate")
			}
			tlsCfg.RootCAs = pool
		}

		if o.tlsCert != "" && o.tlsKey != "" {
			cert, err := tls.X509KeyPair([]byte(o.tlsCert), []byte(o.tlsKey))
			if err != nil {
				return nil, fmt.Errorf("failed to parse client certificate: %w", err)
			}
			tlsCfg.Certificates = []tls.Certificate{cert}
		}

		options.TLSConfig = tlsCfg
	}

	rdb := goredis.NewClient(options)
	return &Client{rdb: rdb}, nil
}

// Close releases the underlying connection pool.
func (c *Client) Close() error {
	return c.rdb.Close()
}

// Ping verifies Redis connectivity.
func (c *Client) Ping(ctx context.Context) error {
	if err := c.rdb.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("redis ping failed: %w", err)
	}
	return nil
}

// Scan returns a batch of keys using SCAN. Pattern may be empty (matches all).
// Count is a hint to Redis about batch size; defaults to 100 when <= 0.
func (c *Client) Scan(ctx context.Context, cursor uint64, pattern string, count int64) (*ScanResult, error) {
	if count <= 0 {
		count = 100
	}
	keys, next, err := c.rdb.Scan(ctx, cursor, pattern, count).Result()
	if err != nil {
		return nil, fmt.Errorf("redis scan failed: %w", err)
	}
	return &ScanResult{Keys: keys, Cursor: next}, nil
}

// GetKeyInfo returns TYPE, TTL, OBJECT ENCODING and MEMORY USAGE for a key.
// Encoding/MemoryUsage are best-effort — older Redis versions may not support
// MEMORY USAGE; we return zero values rather than failing.
func (c *Client) GetKeyInfo(ctx context.Context, key string) (*KeyInfo, error) {
	t, err := c.rdb.Type(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("redis TYPE failed: %w", err)
	}

	ttlDur, err := c.rdb.TTL(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("redis TTL failed: %w", err)
	}

	info := &KeyInfo{
		Key:        key,
		Type:       t,
		TTLSeconds: int64(ttlDur.Seconds()),
	}

	if encoding, encErr := c.rdb.ObjectEncoding(ctx, key).Result(); encErr == nil {
		info.Encoding = encoding
	}

	if mem, memErr := c.rdb.MemoryUsage(ctx, key).Result(); memErr == nil {
		info.MemoryUsage = mem
	}

	return info, nil
}

// GetKeyValue retrieves a key's value with truncation appropriate for its type.
func (c *Client) GetKeyValue(ctx context.Context, key string) (*KeyValue, error) {
	t, err := c.rdb.Type(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("redis TYPE failed: %w", err)
	}
	if t == "none" {
		return nil, fmt.Errorf("key %q does not exist", key)
	}

	kv := &KeyValue{Key: key, Type: t}

	switch t {
	case "string":
		s, err := c.rdb.Get(ctx, key).Result()
		if err != nil && !errors.Is(err, goredis.Nil) {
			return nil, fmt.Errorf("redis GET failed: %w", err)
		}
		kv.TotalSize = int64(len(s))
		if len(s) > stringValueMaxBytes {
			kv.StringValue = s[:stringValueMaxBytes]
			kv.Truncated = true
		} else {
			kv.StringValue = s
		}

	case "hash":
		total, err := c.rdb.HLen(ctx, key).Result()
		if err != nil {
			return nil, fmt.Errorf("redis HLEN failed: %w", err)
		}
		kv.TotalSize = total

		entries, err := scanHash(ctx, c.rdb, key, collectionMaxEntries)
		if err != nil {
			return nil, err
		}
		kv.HashValue = entries
		kv.Truncated = total > int64(len(entries))

	case "list":
		total, err := c.rdb.LLen(ctx, key).Result()
		if err != nil {
			return nil, fmt.Errorf("redis LLEN failed: %w", err)
		}
		kv.TotalSize = total

		items, err := c.rdb.LRange(ctx, key, 0, collectionMaxEntries-1).Result()
		if err != nil {
			return nil, fmt.Errorf("redis LRANGE failed: %w", err)
		}
		kv.ListValue = items
		kv.Truncated = total > int64(len(items))

	case "set":
		total, err := c.rdb.SCard(ctx, key).Result()
		if err != nil {
			return nil, fmt.Errorf("redis SCARD failed: %w", err)
		}
		kv.TotalSize = total

		members, err := scanSet(ctx, c.rdb, key, collectionMaxEntries)
		if err != nil {
			return nil, err
		}
		kv.SetValue = members
		kv.Truncated = total > int64(len(members))

	case "zset":
		total, err := c.rdb.ZCard(ctx, key).Result()
		if err != nil {
			return nil, fmt.Errorf("redis ZCARD failed: %w", err)
		}
		kv.TotalSize = total

		entries, err := scanZSet(ctx, c.rdb, key, collectionMaxEntries)
		if err != nil {
			return nil, err
		}
		kv.ZSetValue = entries
		kv.Truncated = total > int64(len(entries))

	default:
		return nil, fmt.Errorf("unsupported redis type: %s", t)
	}

	return kv, nil
}

// scanHash uses HSCAN to retrieve up to limit field/value pairs.
func scanHash(ctx context.Context, rdb *goredis.Client, key string, limit int) ([]HashEntry, error) {
	var (
		cursor  uint64
		entries []HashEntry
	)
	for {
		batch, next, err := rdb.HScan(ctx, key, cursor, "", int64(limit)).Result()
		if err != nil {
			return nil, fmt.Errorf("redis HSCAN failed: %w", err)
		}
		// HSCAN returns alternating field, value pairs.
		for i := 0; i+1 < len(batch); i += 2 {
			entries = append(entries, HashEntry{Field: batch[i], Value: batch[i+1]})
			if len(entries) >= limit {
				return entries, nil
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	return entries, nil
}

// scanSet uses SSCAN to retrieve up to limit members.
func scanSet(ctx context.Context, rdb *goredis.Client, key string, limit int) ([]string, error) {
	var (
		cursor  uint64
		members []string
	)
	for {
		batch, next, err := rdb.SScan(ctx, key, cursor, "", int64(limit)).Result()
		if err != nil {
			return nil, fmt.Errorf("redis SSCAN failed: %w", err)
		}
		for _, m := range batch {
			members = append(members, m)
			if len(members) >= limit {
				return members, nil
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	return members, nil
}

// scanZSet uses ZSCAN to retrieve up to limit member/score pairs.
func scanZSet(ctx context.Context, rdb *goredis.Client, key string, limit int) ([]ZSetEntry, error) {
	var (
		cursor  uint64
		entries []ZSetEntry
	)
	for {
		batch, next, err := rdb.ZScan(ctx, key, cursor, "", int64(limit)).Result()
		if err != nil {
			return nil, fmt.Errorf("redis ZSCAN failed: %w", err)
		}
		// ZSCAN returns alternating member, score pairs.
		for i := 0; i+1 < len(batch); i += 2 {
			score, parseErr := strconv.ParseFloat(batch[i+1], 64)
			if parseErr != nil {
				continue
			}
			entries = append(entries, ZSetEntry{Member: batch[i], Score: score})
			if len(entries) >= limit {
				return entries, nil
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	return entries, nil
}

// ServerInfo runs INFO and returns parsed server-wide stats.
func (c *Client) ServerInfo(ctx context.Context) (*ServerInfo, error) {
	raw, err := c.rdb.Info(ctx).Result()
	if err != nil {
		return nil, fmt.Errorf("redis INFO failed: %w", err)
	}
	fields := parseInfo(raw)

	info := &ServerInfo{
		Version:          fields["redis_version"],
		UptimeSeconds:    parseInt(fields["uptime_in_seconds"]),
		ConnectedClients: parseInt(fields["connected_clients"]),
		UsedMemory:       parseInt(fields["used_memory"]),
		KeyspaceHits:     parseInt(fields["keyspace_hits"]),
		KeyspaceMisses:   parseInt(fields["keyspace_misses"]),
	}

	// db<N>:keys=N,expires=...,avg_ttl=...
	for k, v := range fields {
		if !strings.HasPrefix(k, "db") {
			continue
		}
		for part := range strings.SplitSeq(v, ",") {
			kv := strings.SplitN(part, "=", 2)
			if len(kv) == 2 && kv[0] == "keys" {
				info.TotalKeys += parseInt(kv[1])
			}
		}
	}

	return info, nil
}

// MemoryStats returns the parsed `INFO memory` section.
func (c *Client) MemoryStats(ctx context.Context) (*MemoryStats, error) {
	raw, err := c.rdb.Info(ctx, "memory").Result()
	if err != nil {
		return nil, fmt.Errorf("redis INFO memory failed: %w", err)
	}
	fields := parseInfo(raw)

	return &MemoryStats{
		UsedMemory:         parseInt(fields["used_memory"]),
		PeakMemory:         parseInt(fields["used_memory_peak"]),
		RSS:                parseInt(fields["used_memory_rss"]),
		FragmentationRatio: parseFloat(fields["mem_fragmentation_ratio"]),
		DatasetSize:        parseInt(fields["used_memory_dataset"]),
		Overhead:           parseInt(fields["used_memory_overhead"]),
		Allocator:          fields["mem_allocator"],
	}, nil
}

// parseInfo splits INFO output (CRLF-separated key:value with `# Section` headers).
func parseInfo(raw string) map[string]string {
	out := make(map[string]string)
	for line := range strings.SplitSeq(raw, "\n") {
		line = strings.TrimRight(line, "\r")
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, ":")
		if idx <= 0 {
			continue
		}
		out[line[:idx]] = line[idx+1:]
	}
	return out
}

func parseInt(s string) int64 {
	n, _ := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
	return n
}

func parseFloat(s string) float64 {
	f, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return f
}
