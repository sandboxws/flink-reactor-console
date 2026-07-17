package factory_test

import (
	"log/slog"
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/instruments/factory"
)

func TestNewKnownTypes(t *testing.T) {
	for _, typ := range factory.SupportedTypes() {
		inst, err := factory.New(typ, "test-"+typ, slog.Default())
		if err != nil {
			t.Fatalf("New(%q) unexpected error: %v", typ, err)
		}
		if inst == nil {
			t.Fatalf("New(%q) returned nil instrument", typ)
		}
		if inst.Type() != typ {
			t.Errorf("New(%q).Type() = %q, want %q", typ, inst.Type(), typ)
		}
		if inst.Name() != "test-"+typ {
			t.Errorf("New(%q).Name() = %q, want %q", typ, inst.Name(), "test-"+typ)
		}
	}
}

func TestNewUnknownType(t *testing.T) {
	inst, err := factory.New("bogus", "x", slog.Default())
	if err == nil {
		t.Fatal("expected an error for an unknown instrument type")
	}
	if inst != nil {
		t.Fatalf("expected nil instrument for unknown type, got %v", inst)
	}
}
