package graphql

import (
	"time"

	"github.com/sandboxws/flink-reactor-console/server/internal/graphql/model"
)

// instrumentTestTimeout bounds a single instrument connection test.
//
// Lives here rather than in instruments.resolvers.go because gqlgen relocates
// any non-resolver code it finds in a *.resolvers.go file into a commented-out
// "WARNING" block on regenerate, which breaks the build.
const instrumentTestTimeout = 10 * time.Second

// instrumentTestFailure builds a failed InstrumentTestResult carrying a message.
func instrumentTestFailure(msg string) *model.InstrumentTestResult {
	return &model.InstrumentTestResult{Ok: false, Message: &msg}
}
