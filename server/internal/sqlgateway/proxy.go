// Package sqlgateway provides a reverse proxy for the Flink SQL Gateway.
package sqlgateway

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

// Proxy is a reverse proxy that forwards requests to a Flink SQL Gateway,
// stripping the path prefix and injecting auth headers.
type Proxy struct {
	handler http.Handler
}

// NewProxy creates a SQL Gateway reverse proxy.
// targetURL is the base URL of the SQL Gateway (e.g., "http://localhost:8083").
// authHeader is the pre-computed Authorization header value (empty string means no auth).
func NewProxy(targetURL string, authHeader string) (*Proxy, error) {
	target, err := url.Parse(targetURL)
	if err != nil {
		return nil, fmt.Errorf("invalid sql gateway url: %w", err)
	}

	proxy := &httputil.ReverseProxy{
		Rewrite: func(r *httputil.ProxyRequest) {
			r.SetURL(target)
			// Strip the /api/sql-gateway prefix from the incoming path.
			r.Out.URL.Path = strings.TrimPrefix(r.In.URL.Path, "/api/sql-gateway")
			if r.Out.URL.Path == "" {
				r.Out.URL.Path = "/"
			}
			r.Out.URL.RawQuery = r.In.URL.RawQuery
			if authHeader != "" {
				r.Out.Header.Set("Authorization", authHeader)
			}
		},
	}

	return &Proxy{handler: proxy}, nil
}

// Handler returns the http.Handler for use with echo.WrapHandler().
func (p *Proxy) Handler() http.Handler {
	return p.handler
}
