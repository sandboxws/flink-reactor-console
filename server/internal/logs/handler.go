// Package logs provides plain-text log proxy endpoints for task managers and job manager.
package logs

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
)

// Register registers log proxy routes on the Echo instance.
// Logs are served as plain text, not via GraphQL, because they are large
// text blobs where JSON encoding adds unnecessary overhead.
func Register(e *echo.Echo, manager *cluster.Manager) {
	g := e.Group("/api/logs")

	g.GET("/taskmanagers/:id", func(c echo.Context) error {
		return proxyLog(c, manager, "/taskmanagers/"+c.Param("id")+"/log")
	})

	g.GET("/taskmanagers/:id/logs/:name", func(c echo.Context) error {
		return proxyLog(c, manager, "/taskmanagers/"+c.Param("id")+"/logs/"+c.Param("name"))
	})

	g.GET("/jobmanager", func(c echo.Context) error {
		return proxyLog(c, manager, "/jobmanager/log")
	})

	g.GET("/jobmanager/logs/:name", func(c echo.Context) error {
		return proxyLog(c, manager, "/jobmanager/logs/"+c.Param("name"))
	})

	// SQL Gateway log proxy — the SQL Gateway is a Flink process that may
	// expose standard Flink monitoring endpoints including /log.
	g.GET("/sql-gateway", func(c echo.Context) error {
		return proxySQLGatewayLog(c, manager, "/log")
	})
}

func proxySQLGatewayLog(c echo.Context, manager *cluster.Manager, path string) error {
	if manager == nil {
		return c.String(http.StatusServiceUnavailable, "cluster manager not configured")
	}

	clusterName := c.QueryParam("cluster")
	var clusterPtr *string
	if clusterName != "" {
		clusterPtr = &clusterName
	}

	conn, err := manager.Resolve(clusterPtr)
	if err != nil {
		return c.String(http.StatusBadRequest, err.Error())
	}

	if conn.SQLClient == nil {
		return c.String(http.StatusServiceUnavailable, "SQL Gateway not configured")
	}

	text, err := conn.SQLClient.GetText(c.Request().Context(), path)
	if err != nil {
		return c.String(http.StatusBadGateway, err.Error())
	}

	return c.String(http.StatusOK, text)
}

func proxyLog(c echo.Context, manager *cluster.Manager, path string) error {
	if manager == nil {
		return c.String(http.StatusServiceUnavailable, "cluster manager not configured")
	}

	clusterName := c.QueryParam("cluster")
	var clusterPtr *string
	if clusterName != "" {
		clusterPtr = &clusterName
	}

	conn, err := manager.Resolve(clusterPtr)
	if err != nil {
		return c.String(http.StatusBadRequest, err.Error())
	}

	text, err := conn.Service.Client().GetText(c.Request().Context(), path)
	if err != nil {
		return c.String(http.StatusBadGateway, err.Error())
	}

	return c.String(http.StatusOK, text)
}
