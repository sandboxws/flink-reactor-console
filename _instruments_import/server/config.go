package instruments

import "encoding/json"

// InstrumentConfig holds the configuration for a single instrument instance.
type InstrumentConfig struct {
	Type   string         `json:"type" mapstructure:"type"`
	Name   string         `json:"name" mapstructure:"name"`
	Config map[string]any `json:"config" mapstructure:"config"`
}

// ConfigJSON returns the Config map marshaled as JSON, suitable for passing
// to Instrument.Init(). Returns nil if Config is empty.
func (ic *InstrumentConfig) ConfigJSON() (json.RawMessage, error) {
	if len(ic.Config) == 0 {
		return nil, nil
	}
	return json.Marshal(ic.Config)
}
