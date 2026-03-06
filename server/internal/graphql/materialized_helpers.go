package graphql

import (
	"fmt"

	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/model"
	"github.com/sandboxws/flink-reactor/apps/server/internal/materialized"
)

func (r *Resolver) resolveMaterializedService(cluster *string) (*materialized.Service, error) {
	conn, err := r.resolveCluster(cluster)
	if err != nil {
		return nil, err
	}
	if conn.SQLClient == nil {
		return nil, fmt.Errorf("SQL Gateway not configured for cluster %q", conn.Name)
	}
	return materialized.NewService(conn.SQLClient), nil
}

func mapMaterializedTable(t *materialized.Table) *model.MaterializedTable {
	result := &model.MaterializedTable{
		Name:          t.Name,
		Catalog:       t.Catalog,
		Database:      t.Database,
		RefreshStatus: mapMaterializedRefreshStatus(t.RefreshStatus),
	}
	if t.RefreshMode != "" {
		result.RefreshMode = &t.RefreshMode
	}
	if t.Freshness != "" {
		result.Freshness = &t.Freshness
	}
	if t.DefiningQuery != "" {
		result.DefiningQuery = &t.DefiningQuery
	}
	return result
}

func mapMaterializedRefreshStatus(s materialized.RefreshStatus) model.MaterializedTableRefreshStatus {
	switch s {
	case materialized.RefreshStatusActivated:
		return model.MaterializedTableRefreshStatusActivated
	case materialized.RefreshStatusSuspended:
		return model.MaterializedTableRefreshStatusSuspended
	case materialized.RefreshStatusInitializing:
		return model.MaterializedTableRefreshStatusInitializing
	default:
		return model.MaterializedTableRefreshStatusInitializing
	}
}
