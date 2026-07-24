package templates

import (
	"strings"
	"testing"
)

func TestLoadEmbeddedRegistry(t *testing.T) {
	reg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if reg.Drift {
		t.Fatalf("embedded manifest reports drift: %s", reg.DriftMsg)
	}

	all := reg.All()
	if len(all) == 0 {
		t.Fatal("expected a non-empty manifest")
	}
	for _, m := range all {
		if m.Name == "" {
			t.Error("template with empty name")
		}
		if m.Description == "" {
			t.Errorf("template %q has empty description", m.Name)
		}
		if m.Category == "" {
			t.Errorf("template %q has empty category", m.Name)
		}
	}
}

func TestByCategoryFiltersCaseInsensitively(t *testing.T) {
	reg, err := Load()
	if err != nil {
		t.Fatalf("Load(): %v", err)
	}

	lake := reg.ByCategory("lakehouse")
	if len(lake) == 0 {
		t.Fatal("expected lakehouse templates")
	}
	for _, m := range lake {
		if !strings.EqualFold(m.Category, "lakehouse") {
			t.Errorf("ByCategory(lakehouse) returned category %q", m.Category)
		}
	}
	if got := reg.ByCategory("LAKEHOUSE"); len(got) != len(lake) {
		t.Errorf("category match should be case-insensitive: %d vs %d", len(got), len(lake))
	}
	if got := reg.ByCategory(""); len(got) != len(reg.All()) {
		t.Error("empty category should return all templates")
	}
}

func TestSourceCarriesFiles(t *testing.T) {
	reg, err := Load()
	if err != nil {
		t.Fatalf("Load(): %v", err)
	}

	src, ok := reg.Source("lakehouse-analytics")
	if !ok {
		t.Fatal("expected source for lakehouse-analytics")
	}
	if len(src.Files) == 0 {
		t.Fatal("expected scaffolded files")
	}
	if src.PipelineTsx == "" {
		t.Error("expected non-empty pipelineTsx")
	}
}
