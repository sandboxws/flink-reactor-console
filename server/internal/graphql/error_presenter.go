package graphql

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/99designs/gqlgen/graphql"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

// NewErrorPresenter returns a gqlgen ErrorPresenterFunc that classifies Flink
// errors into human-friendly messages with typed error codes in extensions.
// Raw error details are logged server-side and never exposed to the client.
func NewErrorPresenter(logger *slog.Logger) graphql.ErrorPresenterFunc {
	return func(ctx context.Context, err error) *gqlerror.Error {
		// Start with the default presenter to preserve path/locations.
		gqlErr := graphql.DefaultErrorPresenter(ctx, err)

		var connErr *flink.ConnectionError
		var timeoutErr *flink.TimeoutError
		var apiErr *flink.APIError

		switch {
		case errors.As(err, &connErr):
			logger.Error("flink connection error", "url", connErr.URL, "error", connErr.Err)
			gqlErr.Message = "Unable to connect to the Flink cluster"
			gqlErr.Extensions = map[string]interface{}{
				"code": "CLUSTER_UNREACHABLE",
			}

		case errors.As(err, &timeoutErr):
			logger.Error("flink request timeout", "url", timeoutErr.URL, "timeout", timeoutErr.Timeout)
			gqlErr.Message = "Request to the Flink cluster timed out"
			gqlErr.Extensions = map[string]interface{}{
				"code": "REQUEST_TIMEOUT",
			}

		case errors.As(err, &apiErr):
			logger.Error("flink api error", "status", apiErr.StatusCode, "errors", apiErr.Errors)
			gqlErr.Message = fmt.Sprintf("Flink API returned an error (HTTP %d)", apiErr.StatusCode)
			gqlErr.Extensions = map[string]interface{}{
				"code": "FLINK_API_ERROR",
			}

		default:
			logger.Error("graphql resolver error", "error", err)
			gqlErr.Extensions = map[string]interface{}{
				"code": "INTERNAL_ERROR",
			}
		}

		return gqlErr
	}
}
