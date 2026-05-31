package graphql

// matchesJobFilter reports whether an event's job id matches an optional job
// filter. A nil filter matches only the empty (cluster-level) job id.
//
// This helper lives outside subscription.resolvers.go on purpose: gqlgen owns
// the *.resolvers.go files and relocates any hand-written helpers it finds
// there into a "to be deleted" comment block on regeneration.
func matchesJobFilter(eventJobID string, filter *string) bool {
	if filter == nil {
		return eventJobID == ""
	}
	return eventJobID == *filter
}
