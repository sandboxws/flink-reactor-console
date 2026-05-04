package graphql

// orEmpty returns a non-nil empty slice when s is nil so GraphQL non-null list
// fields don't surface as JSON null.
func orEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
