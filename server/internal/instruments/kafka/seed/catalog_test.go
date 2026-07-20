package seed

import (
	"strings"
	"testing"
)

func TestLoad(t *testing.T) {
	c, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if c.Version == 0 {
		t.Error("expected non-zero catalog version")
	}
	if len(c.Subjects) == 0 {
		t.Fatal("expected subjects in catalog")
	}
	for _, s := range c.Subjects {
		if s.Topic == "" || s.Subject == "" || s.Domain == "" {
			t.Errorf("subject with empty topic/subject/domain: %+v", s)
		}
		if len(s.JSONSchema) == 0 {
			t.Errorf("subject %q has empty JSON schema", s.Topic)
		}
	}
}

func TestByDomain(t *testing.T) {
	c, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if got := c.ByDomain(""); len(got) != len(c.Subjects) {
		t.Errorf(`ByDomain("") = %d subjects, want %d`, len(got), len(c.Subjects))
	}
	if got := c.ByDomain("all"); len(got) != len(c.Subjects) {
		t.Errorf(`ByDomain("all") = %d subjects, want %d`, len(got), len(c.Subjects))
	}

	ecom := c.ByDomain("ecommerce")
	if len(ecom) == 0 {
		t.Fatal("expected ecommerce subjects")
	}
	for _, s := range ecom {
		if !strings.EqualFold(s.Domain, "ecommerce") {
			t.Errorf("ByDomain(ecommerce) returned domain %q", s.Domain)
		}
	}

	// Case-insensitive match.
	if got := c.ByDomain("EComMerce"); len(got) != len(ecom) {
		t.Errorf("ByDomain is not case-insensitive: %d vs %d", len(got), len(ecom))
	}

	if got := c.ByDomain("does-not-exist"); got != nil {
		t.Errorf("expected nil for unknown domain, got %d subjects", len(got))
	}
}

func TestDomains(t *testing.T) {
	c, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	domains := c.Domains()
	if len(domains) == 0 {
		t.Fatal("expected at least one domain")
	}
	for i := 1; i < len(domains); i++ {
		if domains[i-1] >= domains[i] {
			t.Errorf("domains not strictly sorted/unique: %v", domains)
		}
	}
}
