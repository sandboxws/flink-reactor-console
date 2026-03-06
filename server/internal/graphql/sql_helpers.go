package graphql

import (
	"fmt"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/model"
)

const sqlPollInterval = 200 * time.Millisecond

func convertResultSet(rs *flink.SQLGatewayResultSet) *model.SQLResultBatch {
	columns := make([]*model.SQLColumn, len(rs.Columns))
	for i, c := range rs.Columns {
		columns[i] = &model.SQLColumn{
			Name:     c.Name,
			DataType: c.DataType,
		}
	}

	rows := make([][]*string, len(rs.Data))
	for i, row := range rs.Data {
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

// extractToken gets the last path segment from a SQL Gateway nextUri.
func extractToken(uri string) string {
	for i := len(uri) - 1; i >= 0; i-- {
		if uri[i] == '/' {
			return uri[i+1:]
		}
	}
	return uri
}
