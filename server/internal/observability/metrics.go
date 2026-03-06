package observability

import (
	"github.com/prometheus/client_golang/prometheus"
)

// Namespace for all reactor-server metrics.
const metricsNamespace = "reactor"

// HTTP request metrics.
var (
	HTTPRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Name:      "http_requests_total",
			Help:      "Total number of HTTP requests.",
		},
		[]string{"method", "path", "status"},
	)

	HTTPRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Name:      "http_request_duration_seconds",
			Help:      "HTTP request duration in seconds.",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)
)

// Upstream Flink request metrics.
var (
	FlinkUpstreamRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Name:      "flink_upstream_requests_total",
			Help:      "Total number of upstream requests to Flink clusters.",
		},
		[]string{"cluster", "endpoint", "status"},
	)

	FlinkUpstreamRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Name:      "flink_upstream_request_duration_seconds",
			Help:      "Upstream Flink request duration in seconds.",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"cluster", "endpoint"},
	)
)

// GraphQLResolverDuration records GraphQL resolver execution durations.
var GraphQLResolverDuration = prometheus.NewHistogramVec(
	prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Name:      "graphql_resolver_duration_seconds",
		Help:      "GraphQL resolver execution duration in seconds.",
		Buckets:   prometheus.DefBuckets,
	},
	[]string{"resolver"},
)

// InstrumentHealthStatus tracks health status of instruments (1=healthy, 0=unhealthy).
var InstrumentHealthStatus = prometheus.NewGaugeVec(
	prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Name:      "instrument_health_status",
		Help:      "Health status of instruments (1=healthy, 0=unhealthy).",
	},
	[]string{"instrument", "cluster"},
)

// ActiveSubscriptions tracks the number of active WebSocket subscriptions.
var ActiveSubscriptions = prometheus.NewGaugeVec(
	prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Name:      "active_subscriptions",
		Help:      "Number of active WebSocket subscriptions.",
	},
	[]string{"type"},
)

// RegisterMetrics registers all metrics with the default prometheus registry.
func RegisterMetrics() {
	prometheus.MustRegister(
		HTTPRequestsTotal,
		HTTPRequestDuration,
		FlinkUpstreamRequestsTotal,
		FlinkUpstreamRequestDuration,
		GraphQLResolverDuration,
		InstrumentHealthStatus,
		ActiveSubscriptions,
	)
}
