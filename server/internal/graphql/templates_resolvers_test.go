package graphql_test

import (
	"context"
	"strings"
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/graphql"
	"github.com/sandboxws/flink-reactor-console/server/internal/graphql/model"
	"github.com/sandboxws/flink-reactor-console/server/internal/templates"
)

func templateResolver(t *testing.T) *graphql.Resolver {
	t.Helper()
	reg, err := templates.Load()
	if err != nil {
		t.Fatalf("templates.Load(): %v", err)
	}
	return &graphql.Resolver{TemplateRegistry: reg}
}

// TestTemplates_ListsAllManifestMembers is the G1 data-layer witness: the
// GraphQL result set matches the embedded manifest member-for-member.
func TestTemplates_ListsAllManifestMembers(t *testing.T) {
	t.Parallel()
	r := templateResolver(t)

	got, err := queryResolver(r).Templates(context.Background(), nil)
	if err != nil {
		t.Fatalf("Templates(): %v", err)
	}

	want := r.TemplateRegistry.All()
	if len(got) != len(want) {
		t.Fatalf("Templates() returned %d, want %d", len(got), len(want))
	}

	names := make(map[string]bool, len(got))
	for _, tmpl := range got {
		names[tmpl.Name] = true
		if tmpl.Description == "" {
			t.Errorf("template %q has empty description", tmpl.Name)
		}
	}
	for _, m := range want {
		if !names[m.Name] {
			t.Errorf("Templates() missing manifest member %q", m.Name)
		}
	}
}

func TestTemplates_FilterByCategory(t *testing.T) {
	t.Parallel()
	r := templateResolver(t)

	cat := model.TemplateCategoryLakehouse
	got, err := queryResolver(r).Templates(context.Background(), &cat)
	if err != nil {
		t.Fatalf("Templates(LAKEHOUSE): %v", err)
	}
	if len(got) == 0 {
		t.Fatal("expected lakehouse templates")
	}
	for _, tmpl := range got {
		if tmpl.Category != model.TemplateCategoryLakehouse {
			t.Errorf("category filter leaked %q", tmpl.Category)
		}
	}
}

func TestTemplate_KnownHasDescriptionAndPipelines(t *testing.T) {
	t.Parallel()
	r := templateResolver(t)

	got, err := queryResolver(r).Template(context.Background(), "lakehouse-analytics")
	if err != nil {
		t.Fatalf("Template(): %v", err)
	}
	if got == nil {
		t.Fatal("expected lakehouse-analytics")
	}
	if got.Description == "" {
		t.Error("expected non-empty description")
	}
	if len(got.Pipelines) == 0 {
		t.Error("expected non-empty pipelines")
	}
}

func TestTemplate_UnknownReturnsNil(t *testing.T) {
	t.Parallel()
	r := templateResolver(t)

	got, err := queryResolver(r).Template(context.Background(), "does-not-exist")
	if err != nil {
		t.Fatalf("Template(): %v", err)
	}
	if got != nil {
		t.Errorf("expected nil for unknown template, got %+v", got)
	}
}

// TestInstantiateTemplate_MultiFileNoDeploy verifies instantiation returns the
// template's multi-file project (pipelines + @/schemas/*) with a non-empty
// pipelineTsx. The resolver is built with NO Manager/gateway, so a deploy path
// would nil-panic — reaching a clean result proves no cluster interaction.
func TestInstantiateTemplate_MultiFileNoDeploy(t *testing.T) {
	t.Parallel()
	r := templateResolver(t)

	got, err := r.Mutation().InstantiateTemplate(context.Background(), "lakehouse-analytics", nil)
	if err != nil {
		t.Fatalf("InstantiateTemplate(): %v", err)
	}
	if len(got.Files) < 2 {
		t.Fatalf("expected a multi-file project, got %d files", len(got.Files))
	}
	if got.PipelineTsx == "" {
		t.Error("expected non-empty pipelineTsx")
	}

	var hasSchemas, hasPipeline bool
	for _, f := range got.Files {
		if strings.Contains(f.Path, "schemas/") {
			hasSchemas = true
		}
		if strings.HasSuffix(f.Path, "index.tsx") {
			hasPipeline = true
		}
	}
	if !hasSchemas {
		t.Error("expected @/schemas/* modules in the instantiation")
	}
	if !hasPipeline {
		t.Error("expected a pipeline index.tsx in the instantiation")
	}
}

func TestInstantiateTemplate_UnknownErrors(t *testing.T) {
	t.Parallel()
	r := templateResolver(t)

	if _, err := r.Mutation().InstantiateTemplate(context.Background(), "nope", nil); err == nil {
		t.Error("expected error for unknown template")
	}
}
