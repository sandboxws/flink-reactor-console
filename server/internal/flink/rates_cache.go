package flink

import (
	"context"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

// RatesCacheTTL is how long a cached job rates aggregate is considered fresh.
// Tuned to be just under the dashboard's 5s polling cadence so concurrent polls
// share a single Flink REST fan-out per cycle.
const RatesCacheTTL = 3 * time.Second

// RatesCache coalesces and caches per-job rate aggregates so the `jobs` list
// resolver can populate throughput / watermark-lag fields without paying the
// per-vertex fan-out cost on every poll.
//
// The cache is single-process and memory-only (matches the server's deployment
// model — one server per cluster). Entries are not actively evicted; entries
// for jobs that stop polling are GC'd implicitly when overwritten or on
// process restart. For long-running clusters with many ephemeral jobs this
// could grow, but in practice the active-job set is small.
type RatesCache struct {
	entries sync.Map // key: ratesKey, value: *ratesEntry
	flight  singleflight.Group
}

type ratesKey struct {
	cluster string
	jobID   string
}

type ratesEntry struct {
	agg       *JobDetailAggregate
	fetchedAt time.Time
}

// NewRatesCache returns an empty RatesCache.
func NewRatesCache() *RatesCache {
	return &RatesCache{}
}

// Get returns the cached aggregate for (cluster, jobID) if it was fetched
// within RatesCacheTTL, else (nil, false).
func (c *RatesCache) Get(cluster, jobID string) (*JobDetailAggregate, bool) {
	v, ok := c.entries.Load(ratesKey{cluster, jobID})
	if !ok {
		return nil, false
	}
	entry := v.(*ratesEntry)
	if time.Since(entry.fetchedAt) > RatesCacheTTL {
		return nil, false
	}
	return entry.agg, true
}

// Set stores an aggregate for (cluster, jobID) with the current time.
func (c *RatesCache) Set(cluster, jobID string, agg *JobDetailAggregate) {
	c.entries.Store(ratesKey{cluster, jobID}, &ratesEntry{
		agg:       agg,
		fetchedAt: time.Now(),
	})
}

// Fetch returns the cached aggregate if fresh, otherwise calls fn to fetch
// a new one. Concurrent calls for the same (cluster, jobID) coalesce into a
// single fn invocation; all callers receive the same result.
//
// Use this rather than calling Get + Set manually when concurrent dashboard
// polls might race on a cold cache entry — singleflight prevents the
// thundering herd at TTL expiry.
func (c *RatesCache) Fetch(
	ctx context.Context,
	cluster, jobID string,
	fn func(ctx context.Context) (*JobDetailAggregate, error),
) (*JobDetailAggregate, error) {
	if agg, ok := c.Get(cluster, jobID); ok {
		return agg, nil
	}

	key := cluster + "|" + jobID
	v, err, _ := c.flight.Do(key, func() (any, error) {
		// Re-check inside the singleflight critical section: if another caller
		// just populated the cache before we acquired the flight slot, reuse it.
		if agg, ok := c.Get(cluster, jobID); ok {
			return agg, nil
		}
		agg, err := fn(ctx)
		if err != nil {
			return nil, err
		}
		c.Set(cluster, jobID, agg)
		return agg, nil
	})
	if err != nil {
		return nil, err
	}
	return v.(*JobDetailAggregate), nil
}
