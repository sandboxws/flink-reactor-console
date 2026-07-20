package instruments

import "encoding/json"

// InstrumentConfig holds the configuration for a single instrument instance.
type InstrumentConfig struct {
	Type string `json:"type" mapstructure:"type"`
	Name string `json:"name" mapstructure:"name"`
	// Environment tags the backing system this instrument connects to
	// (e.g. "development", "staging", "production"). It gates environment-
	// sensitive operations such as Kafka seeding. When empty, callers infer it
	// from the instrument name and the server environment.
	Environment string         `json:"environment" mapstructure:"environment"`
	Config      map[string]any `json:"config" mapstructure:"config"`
}

// ConfigJSON returns the Config map marshaled as JSON, suitable for passing
// to Instrument.Init(). Returns nil if Config is empty.
func (ic *InstrumentConfig) ConfigJSON() (json.RawMessage, error) {
	if len(ic.Config) == 0 {
		return nil, nil
	}
	return json.Marshal(ic.Config)
}
