package graphql

import (
	"strconv"

	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
	"github.com/sandboxws/flink-reactor-console/server/internal/graphql/model"
)

// mapApplication converts a Flink ApplicationOverview to a GraphQL Application.
//
// This helper lives in a non-resolver file on purpose: gqlgen relocates any
// non-resolver function it finds in a *.resolvers.go file into a commented-out
// "WARNING" block on every run, which previously left it undefined.
func mapApplication(a *flink.ApplicationOverview) *model.Application {
	var startTime *string
	if a.StartTime > 0 {
		s := strconv.FormatInt(a.StartTime, 10)
		startTime = &s
	}
	return &model.Application{
		ID:        a.ID,
		Name:      a.Name,
		State:     a.State,
		StartTime: startTime,
		JobCount:  a.JobCount,
	}
}
