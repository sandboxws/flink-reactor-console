package k8s

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	sigsyaml "sigs.k8s.io/yaml"
)

// ConfigDiff carries the YAML-serialized blue and pending-green configurations
// of a FlinkBlueGreenDeployment, suitable for rendering in a unified diff view.
type ConfigDiff struct {
	BlueYAML  string
	GreenYAML string
}

// secretFieldRegex matches field names that commonly carry secret values. The
// pattern is anchored to the *substring* match (case-insensitive) so that names
// like "dbPassword" or "API_TOKEN" are caught alongside "password" / "token".
var secretFieldRegex = regexp.MustCompile(`(?i)(password|token|secret|credential)`)

// templateFieldCandidates lists field names under spec that may hold the pod
// template across operator generations. Order matters: the first match wins.
var templateFieldCandidates = []string{"template", "podTemplate", "flinkDeployment", "flinkdeployment"}

// previousTemplatePaths lists candidate locations for the previously-active
// template, scanned in order. Used to surface the blue side of the diff when
// spec.template represents the pending green during a transition.
var previousTemplatePaths = [][]string{
	{"spec", "previousTemplate"},
	{"status", "previousTemplate"},
	{"status", "activeTemplate"},
	{"status", "lastAppliedTemplate"},
	{"status", "lastTemplate"},
}

// BlueGreenConfigDiff fetches the FlinkBlueGreenDeployment CRD and returns the
// blue (currently-active) and pending-green spec.template serialized as YAML.
//
// Behaviour:
//   - Steady state (ACTIVE_BLUE / ACTIVE_GREEN): blueYAML = spec.template,
//     greenYAML = "".
//   - Transitioning / savepointing / initializing-with-prior: blueYAML =
//     previous template (if discoverable), greenYAML = spec.template.
//   - Secret-shaped values are redacted to "***" before serialization.
func (c *Client) BlueGreenConfigDiff(ctx context.Context, name string) (*ConfigDiff, error) {
	obj, err := c.Dynamic.Resource(GVR).Namespace(c.Namespace).Get(ctx, name, getOptions())
	if err != nil {
		return nil, fmt.Errorf("getting FlinkBlueGreenDeployment %q: %w", name, err)
	}
	return buildConfigDiff(obj.Object)
}

// buildConfigDiff is the pure core extracted for testing without a K8s server.
// It accepts the raw unstructured object map (as produced by client-go's
// dynamic Get) and returns the rendered diff.
func buildConfigDiff(raw map[string]any) (*ConfigDiff, error) {
	current := findTemplate(raw)
	previous := findPreviousTemplate(raw)
	state := nestedString(raw, "status", "state")

	transitioning := isTransitioningState(state)

	var blue, green any
	switch {
	case transitioning && previous != nil:
		blue, green = previous, current
	case transitioning:
		// Pending green exists but the operator didn't preserve a prior
		// blue; show only the green side so the user sees what's rolling out.
		blue, green = nil, current
	default:
		blue, green = current, nil
	}

	blueYAML, err := marshalTemplate(blue)
	if err != nil {
		return nil, fmt.Errorf("marshaling blue template: %w", err)
	}
	greenYAML, err := marshalTemplate(green)
	if err != nil {
		return nil, fmt.Errorf("marshaling green template: %w", err)
	}

	return &ConfigDiff{BlueYAML: blueYAML, GreenYAML: greenYAML}, nil
}

// findTemplate walks spec.* looking for a field whose name matches a known
// template alias. Returns the first match (a map or any other shape).
func findTemplate(raw map[string]any) any {
	spec, ok := raw["spec"].(map[string]any)
	if !ok {
		return nil
	}
	for _, key := range templateFieldCandidates {
		if v, exists := spec[key]; exists && v != nil {
			return v
		}
	}
	return nil
}

// findPreviousTemplate scans the well-known paths where various operator
// generations stash the prior template.
func findPreviousTemplate(raw map[string]any) any {
	for _, path := range previousTemplatePaths {
		if v := nestedValue(raw, path...); v != nil {
			return v
		}
	}
	return nil
}

// isTransitioningState reports whether the BG state implies a pending green is
// being rolled out — i.e., the spec.template currently represents the green
// side rather than steady-state blue.
func isTransitioningState(state string) bool {
	if state == "" {
		return false
	}
	switch state {
	case "TRANSITIONING_TO_BLUE",
		"TRANSITIONING_TO_GREEN",
		"SAVEPOINTING_BLUE",
		"SAVEPOINTING_GREEN":
		return true
	}
	return false
}

// marshalTemplate renders the given (possibly-nil) template as YAML, redacting
// secret-shaped values en route. nil yields an empty string so the frontend
// diff viewer can render the empty side as a full add/remove.
func marshalTemplate(t any) (string, error) {
	if t == nil {
		return "", nil
	}
	redacted := redactSecrets(t)
	out, err := sigsyaml.Marshal(redacted)
	if err != nil {
		return "", err
	}
	return strings.TrimRight(string(out), "\n") + "\n", nil
}

// redactSecrets walks a parsed JSON-like tree (map / slice / scalar) and
// returns a copy where values under secret-shaped keys are replaced with
// "***". The original tree is left unmodified so callers can pass shared data
// safely.
func redactSecrets(v any) any {
	switch t := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, val := range t {
			if secretFieldRegex.MatchString(k) && isScalar(val) {
				out[k] = "***"
				continue
			}
			out[k] = redactSecrets(val)
		}
		return out
	case []any:
		out := make([]any, len(t))
		for i, val := range t {
			out[i] = redactSecrets(val)
		}
		return out
	default:
		return v
	}
}

// isScalar reports whether v is a leaf value rather than a map or slice. We
// only redact scalar values under secret-named keys; redacting a nested
// structure (e.g. an envFrom block) would lose information without protecting
// any secret.
func isScalar(v any) bool {
	switch v.(type) {
	case map[string]any, []any:
		return false
	default:
		return true
	}
}

// nestedString reads a string at the given path, returning "" if missing or of
// a different type. Mirrors the unstructured.NestedString helper but operates
// on plain Go maps so tests don't have to wrap fixtures in Unstructured.
func nestedString(raw map[string]any, path ...string) string {
	v := nestedValue(raw, path...)
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// nestedValue walks the given path and returns the value at the leaf, or nil
// if any intermediate hop is missing or not a map.
func nestedValue(raw map[string]any, path ...string) any {
	var cur any = raw
	for _, p := range path {
		m, ok := cur.(map[string]any)
		if !ok {
			return nil
		}
		cur, ok = m[p]
		if !ok {
			return nil
		}
	}
	return cur
}
