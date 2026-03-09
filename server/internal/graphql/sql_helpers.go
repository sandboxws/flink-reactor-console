package graphql

import (
	"fmt"
	"strings"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/model"
)

const sqlPollInterval = 200 * time.Millisecond

func convertResultSet(rs *flink.SQLGatewayResultSet) *model.SQLResultBatch {
	columns := make([]*model.SQLColumn, len(rs.Results.Columns))
	for i, c := range rs.Results.Columns {
		columns[i] = &model.SQLColumn{
			Name:     c.Name,
			DataType: c.LogicalType.Type,
		}
	}

	rows := make([][]*string, len(rs.Results.Data))
	for i, row := range rs.Results.Data {
		cells := make([]*string, len(row.Fields))
		for j, f := range row.Fields {
			s := fmt.Sprintf("%v", f)
			cells[j] = &s
		}
		rows[i] = cells
	}

	return &model.SQLResultBatch{
		Columns: columns,
		Rows:    rows,
	}
}

// extractToken gets the last path segment from a SQL Gateway nextResultUri.
// The URI may contain query parameters (e.g., "?rowFormat=JSON") which are stripped.
func extractToken(uri string) string {
	if idx := strings.IndexByte(uri, '?'); idx >= 0 {
		uri = uri[:idx]
	}
	for i := len(uri) - 1; i >= 0; i-- {
		if uri[i] == '/' {
			return uri[i+1:]
		}
	}
	return uri
}
