package observability

import (
	"context"
	"log/slog"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/ast"
)

// GraphQLMetrics is a gqlgen extension that records resolver durations
// and logs GraphQL operations with their operation name and type.
type GraphQLMetrics struct {
	Logger *slog.Logger
}

var _ interface {
	graphql.HandlerExtension
	graphql.OperationInterceptor
	graphql.FieldInterceptor
} = GraphQLMetrics{}

// ExtensionName returns the name of this extension.
func (GraphQLMetrics) ExtensionName() string { return "PrometheusMetrics" }

// Validate is a no-op; this extension has no schema requirements.
func (GraphQLMetrics) Validate(_ graphql.ExecutableSchema) error { return nil }

// InterceptOperation logs each GraphQL operation with its name, type, and duration.
func (m GraphQLMetrics) InterceptOperation(ctx context.Context, next graphql.OperationHandler) graphql.ResponseHandler {
	start := time.Now()
	oc := graphql.GetOperationContext(ctx)

	handler := next(ctx)

	return func(ctx context.Context) *graphql.Response {
		resp := handler(ctx)
		if resp == nil {
			return nil
		}

		if m.Logger == nil {
			return resp
		}

		name := oc.OperationName
		if name == "" {
			name = "anonymous"
		}
		opType := "query"
		if oc.Operation != nil {
			switch oc.Operation.Operation {
			case ast.Mutation:
				opType = "mutation"
			case ast.Subscription:
				opType = "subscription"
			}
		}

		attrs := []any{
			"operation", name,
			"type", opType,
			"duration_ms", time.Since(start).Milliseconds(),
		}
		if len(resp.Errors) > 0 {
			attrs = append(attrs, "errors", len(resp.Errors))
			m.Logger.Warn("graphql", attrs...)
		} else {
			m.Logger.Info("graphql", attrs...)
		}

		return resp
	}
}

// InterceptField wraps resolver execution with duration tracking.
func (m GraphQLMetrics) InterceptField(ctx context.Context, next graphql.Resolver) (any, error) {
	fc := graphql.GetFieldContext(ctx)
	if fc == nil || !fc.IsResolver {
		return next(ctx)
	}

	start := time.Now()
	res, err := next(ctx)
	GraphQLResolverDuration.WithLabelValues(fc.Field.Name).Observe(time.Since(start).Seconds())
	return res, err
}
