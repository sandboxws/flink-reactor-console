package bgsync

import "testing"

func TestCountChurn(t *testing.T) {
	set := func(ids ...string) map[string]struct{} {
		m := make(map[string]struct{}, len(ids))
		for _, id := range ids {
			m[id] = struct{}{}
		}
		return m
	}

	cases := []struct {
		name string
		prev map[string]struct{}
		cur  map[string]struct{}
		want int
	}{
		{"stable", set("a", "b"), set("a", "b"), 0},
		// The key case: count stays at 2 but b was replaced by c.
		{"replaced, count flat", set("a", "b"), set("a", "c"), 2},
		{"one gone", set("a", "b"), set("a"), 1},
		{"one added", set("a"), set("a", "b"), 1},
		{"all replaced", set("a", "b"), set("c", "d"), 4},
		{"from empty", set(), set("a", "b"), 2},
	}

	for _, tc := range cases {
		if got := countChurn(tc.prev, tc.cur); got != tc.want {
			t.Errorf("%s: countChurn = %d, want %d", tc.name, got, tc.want)
		}
	}
}
