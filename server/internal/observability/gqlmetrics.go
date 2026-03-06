package observability

import (
	"context"
	"time"

	"github.com/99designs/gqlgen/graphql"
)

// GraphQLMetrics is a gqlgen extension that records resolver durations.
type GraphQLMetrics struct{}

var _ interface {
	graphql.HandlerExtension
	graphql.FieldInterceptor
} = GraphQLMetrics{}

// ExtensionName returns the name of this extension.
func (GraphQLMetrics) ExtensionName() string { return "PrometheusMetrics" }

// Validate is a no-op; this extension has no schema requirements.
func (GraphQLMetrics) Validate(_ graphql.ExecutableSchema) error { return nil }

// InterceptField wraps resolver execution with duration tracking.
func (GraphQLMetrics) InterceptField(ctx context.Context, next graphql.Resolver) (any, error) {
	fc := graphql.GetFieldContext(ctx)
	if fc == nil || !fc.IsResolver {
		return next(ctx)
	}

	start := time.Now()
	res, err := next(ctx)
	GraphQLResolverDuration.WithLabelValues(fc.Field.Name).Observe(time.Since(start).Seconds())
	return res, err
}
