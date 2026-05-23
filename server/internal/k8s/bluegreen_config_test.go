package k8s

import (
	"strings"
	"testing"
)

// templateFixture is a representative spec.template containing scalars, a
// nested map, a list, and a secret-shaped field. Used as the shared input for
// most steady-state and redaction tests below.
func templateFixture() map[string]any {
	return map[string]any{
		"image":       "flink:1.20",
		"parallelism": 4,
		"config": map[string]any{
			"checkpointInterval": "60s",
			"dbPassword":         "hunter2",
			"apiToken":           "abcd-efgh",
		},
		"env": []any{
			map[string]any{"name": "LOG_LEVEL", "value": "INFO"},
			map[string]any{"name": "SECRET_KEY", "value": "shh"},
		},
	}
}

func TestBuildConfigDiff_SteadyState(t *testing.T) {
	raw := map[string]any{
		"spec": map[string]any{
			"template": templateFixture(),
		},
		"status": map[string]any{"state": "ACTIVE_BLUE"},
	}

	diff, err := buildConfigDiff(raw)
	if err != nil {
		t.Fatalf("buildConfigDiff: %v", err)
	}
	if diff.BlueYAML == "" {
		t.Error("expected non-empty blueYAML in steady state")
	}
	if diff.GreenYAML != "" {
		t.Errorf("expected empty greenYAML in steady state, got %q", diff.GreenYAML)
	}
	if !strings.Contains(diff.BlueYAML, "image: flink:1.20") {
		t.Errorf("expected blue YAML to contain image field, got:\n%s", diff.BlueYAML)
	}
}

func TestBuildConfigDiff_TransitioningWithPrevious(t *testing.T) {
	raw := map[string]any{
		"spec": map[string]any{
			"template": map[string]any{"image": "flink:1.21", "parallelism": 8},
			"previousTemplate": map[string]any{
				"image":       "flink:1.20",
				"parallelism": 4,
			},
		},
		"status": map[string]any{"state": "TRANSITIONING_TO_GREEN"},
	}

	diff, err := buildConfigDiff(raw)
	if err != nil {
		t.Fatalf("buildConfigDiff: %v", err)
	}
	if !strings.Contains(diff.BlueYAML, "flink:1.20") {
		t.Errorf("expected blue YAML to come from previousTemplate (1.20), got:\n%s", diff.BlueYAML)
	}
	if !strings.Contains(diff.GreenYAML, "flink:1.21") {
		t.Errorf("expected green YAML to come from spec.template (1.21), got:\n%s", diff.GreenYAML)
	}
}

func TestBuildConfigDiff_TransitioningWithoutPrevious(t *testing.T) {
	raw := map[string]any{
		"spec": map[string]any{
			"template": map[string]any{"image": "flink:1.21"},
		},
		"status": map[string]any{"state": "SAVEPOINTING_BLUE"},
	}

	diff, err := buildConfigDiff(raw)
	if err != nil {
		t.Fatalf("buildConfigDiff: %v", err)
	}
	if diff.BlueYAML != "" {
		t.Errorf("expected empty blueYAML when previous is unknown, got %q", diff.BlueYAML)
	}
	if diff.GreenYAML == "" {
		t.Error("expected non-empty greenYAML during transition")
	}
}

func TestBuildConfigDiff_RedactsSecretFields(t *testing.T) {
	raw := map[string]any{
		"spec":   map[string]any{"template": templateFixture()},
		"status": map[string]any{"state": "ACTIVE_BLUE"},
	}

	diff, err := buildConfigDiff(raw)
	if err != nil {
		t.Fatalf("buildConfigDiff: %v", err)
	}
	if strings.Contains(diff.BlueYAML, "hunter2") {
		t.Errorf("blueYAML must redact dbPassword, found raw value:\n%s", diff.BlueYAML)
	}
	if strings.Contains(diff.BlueYAML, "abcd-efgh") {
		t.Errorf("blueYAML must redact apiToken, found raw value:\n%s", diff.BlueYAML)
	}
	if !strings.Contains(diff.BlueYAML, "dbPassword: '***'") &&
		!strings.Contains(diff.BlueYAML, `dbPassword: "***"`) &&
		!strings.Contains(diff.BlueYAML, "dbPassword: ***") {
		t.Errorf("expected dbPassword to render as ***, got:\n%s", diff.BlueYAML)
	}
}

func TestBuildConfigDiff_PreservesNonSecretFields(t *testing.T) {
	raw := map[string]any{
		"spec":   map[string]any{"template": templateFixture()},
		"status": map[string]any{"state": "ACTIVE_BLUE"},
	}

	diff, err := buildConfigDiff(raw)
	if err != nil {
		t.Fatalf("buildConfigDiff: %v", err)
	}
	if !strings.Contains(diff.BlueYAML, "parallelism: 4") {
		t.Errorf("expected parallelism preserved verbatim, got:\n%s", diff.BlueYAML)
	}
	if !strings.Contains(diff.BlueYAML, "image: flink:1.20") {
		t.Errorf("expected image preserved verbatim, got:\n%s", diff.BlueYAML)
	}
}

func TestBuildConfigDiff_DeterministicOutput(t *testing.T) {
	raw := map[string]any{
		"spec":   map[string]any{"template": templateFixture()},
		"status": map[string]any{"state": "ACTIVE_BLUE"},
	}

	first, err := buildConfigDiff(raw)
	if err != nil {
		t.Fatalf("first buildConfigDiff: %v", err)
	}
	for i := range 5 {
		next, err := buildConfigDiff(raw)
		if err != nil {
			t.Fatalf("buildConfigDiff iter %d: %v", i, err)
		}
		if next.BlueYAML != first.BlueYAML {
			t.Errorf("blueYAML drift on iter %d:\nfirst:\n%s\ngot:\n%s", i, first.BlueYAML, next.BlueYAML)
		}
		if next.GreenYAML != first.GreenYAML {
			t.Errorf("greenYAML drift on iter %d", i)
		}
	}
}

func TestBuildConfigDiff_AlternativeTemplateFieldName(t *testing.T) {
	raw := map[string]any{
		"spec": map[string]any{
			"podTemplate": map[string]any{"image": "flink:1.20"},
		},
		"status": map[string]any{"state": "ACTIVE_BLUE"},
	}

	diff, err := buildConfigDiff(raw)
	if err != nil {
		t.Fatalf("buildConfigDiff: %v", err)
	}
	if !strings.Contains(diff.BlueYAML, "flink:1.20") {
		t.Errorf("expected fallback to podTemplate field, got:\n%s", diff.BlueYAML)
	}
}

func TestBuildConfigDiff_NoTemplate(t *testing.T) {
	raw := map[string]any{
		"spec":   map[string]any{},
		"status": map[string]any{"state": "ACTIVE_BLUE"},
	}

	diff, err := buildConfigDiff(raw)
	if err != nil {
		t.Fatalf("buildConfigDiff: %v", err)
	}
	if diff.BlueYAML != "" || diff.GreenYAML != "" {
		t.Errorf("expected both sides empty when no template found, got blue=%q green=%q", diff.BlueYAML, diff.GreenYAML)
	}
}

func TestRedactSecrets_NestedScalarsOnly(t *testing.T) {
	input := map[string]any{
		"password":  "shh",
		"username":  "alice",
		"secretRef": map[string]any{"name": "db-creds", "key": "url"},
		"tokens":    []any{"a", "b"},
	}

	out := redactSecrets(input).(map[string]any)
	if out["password"] != "***" {
		t.Errorf("expected password redacted, got %v", out["password"])
	}
	if out["username"] != "alice" {
		t.Errorf("expected username preserved, got %v", out["username"])
	}
	// secretRef is a map, not a scalar — must be recursed into, not replaced.
	nested, ok := out["secretRef"].(map[string]any)
	if !ok {
		t.Fatalf("expected secretRef preserved as map, got %T", out["secretRef"])
	}
	if nested["name"] != "db-creds" {
		t.Errorf("expected nested secretRef.name preserved, got %v", nested["name"])
	}
	// "tokens" matches the secret regex but is a list — recursed into, list
	// contents preserved (we only redact scalars under a secret-shaped key,
	// and the list elements aren't keyed).
	if _, ok := out["tokens"].([]any); !ok {
		t.Errorf("expected tokens preserved as list, got %T", out["tokens"])
	}
}

func TestIsTransitioningState(t *testing.T) {
	tests := []struct {
		state string
		want  bool
	}{
		{"ACTIVE_BLUE", false},
		{"ACTIVE_GREEN", false},
		{"INITIALIZING_BLUE", false},
		{"TRANSITIONING_TO_BLUE", true},
		{"TRANSITIONING_TO_GREEN", true},
		{"SAVEPOINTING_BLUE", true},
		{"SAVEPOINTING_GREEN", true},
		{"", false},
		{"UNKNOWN", false},
	}
	for _, tc := range tests {
		if got := isTransitioningState(tc.state); got != tc.want {
			t.Errorf("isTransitioningState(%q) = %v, want %v", tc.state, got, tc.want)
		}
	}
}
