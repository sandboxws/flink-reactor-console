package materialized

import "testing"

func TestRefreshStatusConstants(t *testing.T) {
	tests := []struct {
		status RefreshStatus
		want   string
	}{
		{RefreshStatusActivated, "ACTIVATED"},
		{RefreshStatusSuspended, "SUSPENDED"},
		{RefreshStatusInitializing, "INITIALIZING"},
	}

	for _, tt := range tests {
		if string(tt.status) != tt.want {
			t.Errorf("RefreshStatus = %q, want %q", tt.status, tt.want)
		}
	}
}

func TestTableStruct(t *testing.T) {
	table := Table{
		Name:          "user_summary",
		Catalog:       "paimon",
		Database:      "mydb",
		RefreshStatus: RefreshStatusActivated,
		RefreshMode:   "CONTINUOUS",
		Freshness:     "INTERVAL '30' SECOND",
		DefiningQuery: "SELECT user_id, COUNT(*) FROM events GROUP BY user_id",
	}

	if table.Name != "user_summary" {
		t.Errorf("Name = %q, want %q", table.Name, "user_summary")
	}
	if table.RefreshStatus != RefreshStatusActivated {
		t.Errorf("RefreshStatus = %q, want %q", table.RefreshStatus, RefreshStatusActivated)
	}
}
