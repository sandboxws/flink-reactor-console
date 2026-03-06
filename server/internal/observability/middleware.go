package observability

import (
	"fmt"
	"time"

	"github.com/labstack/echo/v4"
)

// MetricsMiddleware returns an Echo middleware that records HTTP request
// count and duration as Prometheus metrics.
func MetricsMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()
			err := next(c)

			duration := time.Since(start).Seconds()
			status := fmt.Sprintf("%d", c.Response().Status)
			method := c.Request().Method
			path := c.Path() // registered route pattern, not raw URL

			HTTPRequestsTotal.WithLabelValues(method, path, status).Inc()
			HTTPRequestDuration.WithLabelValues(method, path).Observe(duration)

			return err
		}
	}
}
