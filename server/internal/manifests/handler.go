package manifests

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/sandboxws/flink-reactor-console/server/internal/compatibility"
)

// Register mounts the pipeline-manifest ingest endpoint. A nil store makes the
// endpoint return 503 (storage disabled), mirroring the tap handler.
func Register(e *echo.Echo, s *Store) {
	e.POST("/api/pipeline-manifests", handlePost(s))
}

// handlePost ingests a State Manifest pushed by the DSL, versioning it on write.
// The environment is taken from the `environment` query param (default "default").
func handlePost(s *Store) echo.HandlerFunc {
	return func(c echo.Context) error {
		if s == nil {
			return c.JSON(http.StatusServiceUnavailable, map[string]string{
				"error": "storage not enabled",
			})
		}

		var sm compatibility.StateManifest
		if err := c.Bind(&sm); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid request body: " + err.Error(),
			})
		}
		if sm.PipelineName == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "pipelineName is required",
			})
		}

		row, err := s.Ingest(c.Request().Context(), sm, c.QueryParam("environment"))
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": err.Error(),
			})
		}

		return c.JSON(http.StatusCreated, map[string]any{
			"status":      "ok",
			"pipeline":    row.PipelineName,
			"environment": row.Environment,
			"version":     row.Version,
		})
	}
}
