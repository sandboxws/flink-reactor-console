// Package metrics provides JSON proxy endpoints for Flink metrics.
// Unlike the GraphQL layer, the metrics explorer needs to dynamically
// list and poll arbitrary metric names — a REST proxy is a better fit.
package metrics

import (
	"encoding/json"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
)

// Register registers metrics proxy routes on the Echo instance.
func Register(e *echo.Echo, manager *cluster.Manager) {
	g := e.Group("/api/flink")

	g.GET("/jobmanager/metrics", func(c echo.Context) error {
		return proxyMetrics(c, manager, "/jobmanager/metrics")
	})

	g.GET("/taskmanagers/:id/metrics", func(c echo.Context) error {
		return proxyMetrics(c, manager, "/taskmanagers/"+c.Param("id")+"/metrics")
	})

	g.GET("/jobs/:jid/vertices/:vid/metrics", func(c echo.Context) error {
		return proxyMetrics(c, manager, "/jobs/"+c.Param("jid")+"/vertices/"+c.Param("vid")+"/metrics")
	})
}

func proxyMetrics(c echo.Context, manager *cluster.Manager, path string) error {
	if manager == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "cluster manager not configured"})
	}

	clusterName := c.QueryParam("cluster")
	var clusterPtr *string
	if clusterName != "" {
		clusterPtr = &clusterName
	}

	conn, err := manager.Resolve(clusterPtr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	// Forward the ?get= query parameter for filtered metric values.
	if get := c.QueryParam("get"); get != "" {
		path += "?get=" + get
	}

	var raw json.RawMessage
	if err := conn.Service.Client().GetJSON(c.Request().Context(), path, &raw); err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": err.Error()})
	}

	return c.JSONBlob(http.StatusOK, raw)
}
