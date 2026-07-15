package store

import (
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/storage"
)

func TestAllowedTransitionsFromFiring(t *testing.T) {
	cases := []struct {
		to    string
		valid bool
	}{
		{storage.AlertStateAcknowledged, true},
		{storage.AlertStateSilenced, true},
		{storage.AlertStateResolved, true},
		{storage.AlertStateFiring, false},
	}
	for _, c := range cases {
		got := allowedTransition(storage.AlertStateFiring, c.to)
		if got != c.valid {
			t.Errorf("FIRING -> %s: want %v, got %v", c.to, c.valid, got)
		}
	}
}

func TestAllowedTransitionsTerminalRules(t *testing.T) {
	// RESOLVED is terminal — nothing leaves it.
	for _, to := range []string{
		storage.AlertStateFiring,
		storage.AlertStateAcknowledged,
		storage.AlertStateSilenced,
		storage.AlertStateResolved,
	} {
		if allowedTransition(storage.AlertStateResolved, to) {
			t.Errorf("RESOLVED -> %s should not be allowed", to)
		}
	}
	// ACKNOWLEDGED -> RESOLVED only
	if !allowedTransition(storage.AlertStateAcknowledged, storage.AlertStateResolved) {
		t.Error("ACKNOWLEDGED -> RESOLVED should be allowed")
	}
	if allowedTransition(storage.AlertStateAcknowledged, storage.AlertStateFiring) {
		t.Error("ACKNOWLEDGED -> FIRING should not be allowed")
	}
	// SILENCED -> RESOLVED only
	if !allowedTransition(storage.AlertStateSilenced, storage.AlertStateResolved) {
		t.Error("SILENCED -> RESOLVED should be allowed")
	}
	if allowedTransition(storage.AlertStateSilenced, storage.AlertStateAcknowledged) {
		t.Error("SILENCED -> ACKNOWLEDGED should not be allowed")
	}
}

func TestIsValidNextState(t *testing.T) {
	if !isValidNextState(storage.AlertStateAcknowledged) {
		t.Error("ACKNOWLEDGED should be a valid next state")
	}
	if isValidNextState(storage.AlertStateFiring) {
		t.Error("FIRING should not be a valid next state (instances open into FIRING via OpenInstance, not via transition)")
	}
	if isValidNextState("MADE_UP") {
		t.Error("garbage should not be a valid next state")
	}
}
