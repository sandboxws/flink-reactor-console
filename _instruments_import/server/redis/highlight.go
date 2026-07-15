package redis

import (
	"context"
	"path"
	"regexp"
	"strings"

	instruments "github.com/sandboxws/flink-reactor-instruments"
)

// Patterns to extract Redis-related properties from Flink SQL CREATE TABLE statements.
// Flink Redis connectors typically expose key-pattern, key-prefix, or key.column properties.
var (
	redisConnectorPattern  = regexp.MustCompile(`(?i)'connector'\s*=\s*'redis(?:[a-z-]*)?'`)
	keyPatternPropPattern  = regexp.MustCompile(`(?i)'(?:lookup\.key-pattern|key-pattern)'\s*=\s*'([^']+)'`)
	keyPrefixPropPattern   = regexp.MustCompile(`(?i)'(?:key-prefix|lookup\.key-prefix)'\s*=\s*'([^']+)'`)
)

// HighlightResources finds Redis key patterns referenced in pipeline SQL and
// matches them against keys observed in this Redis instance.
//
// Behaviour mirrors the kafka instrument: parse CREATE TABLE blocks for Redis
// connector properties, extract key patterns, then scan the Redis keyspace for
// any matching keys. The matched glob pattern itself becomes the ResourceRef
// name — UI consumers can drive a SCAN with that pattern to expand the matches.
func (i *Instrument) HighlightResources(ctx context.Context, pipelineSQL string) ([]instruments.ResourceRef, error) {
	if i.client == nil {
		return nil, nil
	}

	patterns := extractRedisRefs(pipelineSQL)
	if len(patterns) == 0 {
		return nil, nil
	}

	keys, err := scanAllKeys(ctx, i.client, "")
	if err != nil {
		return nil, err
	}

	return matchAgainstKeys(patterns, keys), nil
}

// extractRedisRefs parses CREATE TABLE blocks for Redis connector properties
// and returns pattern -> role mappings.
//
// The role is "source" by default; sinks would be inferred from a downstream
// INSERT INTO targeting the table, but tracking that requires a SQL parser, so
// we tag everything as "source" for now (matching kafka's connector-property
// path which does the same).
func extractRedisRefs(sql string) map[string]string {
	refs := make(map[string]string)

	// We only consider patterns/prefixes that appear in the same CREATE TABLE
	// block as a redis connector. Split the SQL on CREATE TABLE and walk each
	// chunk; cheap and avoids matching unrelated properties elsewhere.
	for chunk := range strings.SplitSeq(sql, "CREATE TABLE") {
		if !redisConnectorPattern.MatchString(chunk) {
			continue
		}

		for _, match := range keyPatternPropPattern.FindAllStringSubmatch(chunk, -1) {
			refs[match[1]] = "source"
		}
		for _, match := range keyPrefixPropPattern.FindAllStringSubmatch(chunk, -1) {
			// A prefix is a glob match: "user" -> "user*".
			refs[match[1]+"*"] = "source"
		}
	}

	return refs
}

// matchAgainstKeys filters patterns to those that match at least one observed key.
func matchAgainstKeys(patterns map[string]string, keys []string) []instruments.ResourceRef {
	var result []instruments.ResourceRef
	for pattern, role := range patterns {
		matched := false
		for _, k := range keys {
			ok, err := path.Match(pattern, k)
			if err != nil {
				continue
			}
			if ok {
				matched = true
				break
			}
		}
		if matched {
			result = append(result, instruments.ResourceRef{
				Name:             pattern,
				Role:             role,
				PipelineRelevant: true,
			})
		}
	}
	return result
}

// scanAllKeys runs SCAN until cursor wraps to 0, gathering keys (capped to
// avoid runaway scans on very large keyspaces).
func scanAllKeys(ctx context.Context, c *Client, pattern string) ([]string, error) {
	const maxKeys = 10_000
	var (
		cursor uint64
		out    []string
	)
	for {
		res, err := c.Scan(ctx, cursor, pattern, 1000)
		if err != nil {
			return nil, err
		}
		out = append(out, res.Keys...)
		cursor = res.Cursor
		if cursor == 0 || len(out) >= maxKeys {
			break
		}
	}
	return out, nil
}
