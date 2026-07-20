package config

import "testing"

func TestEnvAllowsSeeding(t *testing.T) {
	cases := []struct {
		env            string
		stagingEnabled bool
		want           bool
	}{
		{"development", false, true},
		{"development", true, true},
		{"production", false, false},
		{"production", true, false}, // hard block: the flag cannot lift it
		{"staging", false, false},
		{"staging", true, true},
		{"test", false, false},
		{"test", true, true},
		{"", false, false},
	}
	for _, tc := range cases {
		if got := envAllowsSeeding(tc.env, tc.stagingEnabled); got != tc.want {
			t.Errorf("envAllowsSeeding(%q, %v) = %v, want %v", tc.env, tc.stagingEnabled, got, tc.want)
		}
	}
}

func TestSeedingAllowed(t *testing.T) {
	cases := []struct {
		name           string
		serverEnv      string
		instrumentEnv  string
		stagingEnabled bool
		want           bool
	}{
		{"dev server, untagged instrument", "development", "", false, true},
		{"dev server, dev instrument", "development", "development", false, true},
		{"dev server, prod instrument blocked", "development", "production", true, false},
		{"prod server always blocked", "production", "development", true, false},
		{"staging both sides, flag on", "staging", "staging", true, true},
		{"staging both sides, flag off", "staging", "staging", false, false},
		{"staging server, prod instrument blocked", "staging", "production", true, false},
	}
	for _, tc := range cases {
		if got := SeedingAllowed(tc.serverEnv, tc.instrumentEnv, tc.stagingEnabled); got != tc.want {
			t.Errorf("%s: SeedingAllowed(%q, %q, %v) = %v, want %v",
				tc.name, tc.serverEnv, tc.instrumentEnv, tc.stagingEnabled, got, tc.want)
		}
	}
}

func TestInferInstrumentEnv(t *testing.T) {
	cases := []struct {
		instrName string
		explicit  string
		serverEnv string
		want      string
	}{
		{"local-kafka", "", "development", "development"},
		{"prod-kafka", "", "development", "production"},
		{"kafka-production", "", "development", "production"},
		{"staging-events", "", "development", "staging"},
		{"preview-cluster", "", "development", "staging"},
		{"prod-mirror", "development", "production", "development"}, // explicit tag wins over "prod" in name
		{"local-kafka", "", "production", "production"},             // untagged falls back to server env
	}
	for _, tc := range cases {
		if got := InferInstrumentEnv(tc.instrName, tc.explicit, tc.serverEnv); got != tc.want {
			t.Errorf("InferInstrumentEnv(%q, %q, %q) = %q, want %q",
				tc.instrName, tc.explicit, tc.serverEnv, got, tc.want)
		}
	}
}
