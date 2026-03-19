package tap

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// Register registers tap manifest REST endpoints on the Echo instance.
// The store may be nil — GET returns 404, POST/DELETE return 503.
func Register(e *echo.Echo, s *Store) {
	e.GET("/api/flink/tap-manifest", handleGet(s))
	e.POST("/api/tap-manifests", handlePost(s))
	e.DELETE("/api/tap-manifests/:pipeline", handleDelete(s))
}

func handleGet(s *Store) echo.HandlerFunc {
	return func(c echo.Context) error {
		if s == nil {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "tap manifests not configured",
			})
		}

		pipeline := c.QueryParam("pipeline")
		if pipeline == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "missing required query parameter: pipeline",
			})
		}

		manifest, err := s.ManifestByPipeline(c.Request().Context(), pipeline)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": err.Error(),
			})
		}
		if manifest == nil {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "no tap manifest found for pipeline: " + pipeline,
			})
		}

		return c.JSON(http.StatusOK, manifest)
	}
}

func handlePost(s *Store) echo.HandlerFunc {
	return func(c echo.Context) error {
		if s == nil {
			return c.JSON(http.StatusServiceUnavailable, map[string]string{
				"error": "storage not enabled",
			})
		}

		var m Manifest
		if err := c.Bind(&m); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid request body: " + err.Error(),
			})
		}

		if m.PipelineName == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "pipelineName is required",
			})
		}

		if err := s.Upsert(c.Request().Context(), m); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": err.Error(),
			})
		}

		return c.JSON(http.StatusCreated, map[string]string{
			"status":   "ok",
			"pipeline": m.PipelineName,
		})
	}
}

func handleDelete(s *Store) echo.HandlerFunc {
	return func(c echo.Context) error {
		if s == nil {
			return c.JSON(http.StatusServiceUnavailable, map[string]string{
				"error": "storage not enabled",
			})
		}

		pipeline := c.Param("pipeline")
		deleted, err := s.Delete(c.Request().Context(), pipeline)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": err.Error(),
			})
		}
		if !deleted {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "no tap manifest found for pipeline: " + pipeline,
			})
		}

		return c.NoContent(http.StatusNoContent)
	}
}
