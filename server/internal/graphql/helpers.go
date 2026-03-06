package graphql

import (
	"fmt"
	"strconv"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	kafkainst "github.com/sandboxws/flink-reactor/apps/server/internal/instruments/kafka"
)

// resolveCluster resolves a cluster connection from an optional cluster name.
func (r *Resolver) resolveCluster(clusterName *string) (*cluster.Connection, error) {
	if r.Manager == nil {
		return nil, fmt.Errorf("cluster manager not configured")
	}
	return r.Manager.Resolve(clusterName)
}

func (r *queryResolver) resolveKafkaInstrument(instrument string) (*kafkainst.Instrument, error) {
	if r.InstrumentRegistry == nil {
		return nil, fmt.Errorf("instruments not configured")
	}
	inst, err := r.InstrumentRegistry.Get(instrument)
	if err != nil {
		return nil, err
	}
	ki, ok := inst.(*kafkainst.Instrument)
	if !ok {
		return nil, fmt.Errorf("instrument %q is not a Kafka instrument", instrument)
	}
	return ki, nil
}

// i64 converts an int64 to string for GraphQL String! fields.
func i64(v int64) string {
	return strconv.FormatInt(v, 10)
}

// f64 converts a float64 to its integer string representation for GraphQL String! fields.
// Flink REST returns metric values as JSON floats (e.g. 68.0); we truncate to int.
func f64(v float64) string {
	return strconv.FormatInt(int64(v), 10)
}

// derefI64 converts an *int64 to string, returning "0" for nil.
func derefI64(v *int64) string {
	if v == nil {
		return "0"
	}
	return strconv.FormatInt(*v, 10)
}

// i64p converts an *int64 to *string for GraphQL String fields.
func i64p(v *int64) *string {
	if v == nil {
		return nil
	}
	s := strconv.FormatInt(*v, 10)
	return &s
}
