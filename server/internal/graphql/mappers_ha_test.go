package graphql

import (
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
)

func TestMapHAStatus_KubernetesEnabled(t *testing.T) {
	t.Parallel()

	cfg := []flink.JMConfigEntry{
		{Key: "high-availability.type", Value: "kubernetes"},
		{Key: "high-availability.storageDir", Value: "s3://bucket/ha"},
		{Key: "high-availability.cluster-id", Value: "my-cluster"},
		{Key: "rest.port", Value: "8081"}, // unrelated key — must not leak
	}

	ha := mapHAStatus(cfg)
	if ha == nil || !ha.Enabled {
		t.Fatalf("expected enabled HA, got %+v", ha)
	}
	if ha.Mode != "kubernetes" {
		t.Errorf("mode = %q, want kubernetes", ha.Mode)
	}
	if ha.StorageDir == nil || *ha.StorageDir != "s3://bucket/ha" {
		t.Errorf("storageDir = %v, want s3://bucket/ha", ha.StorageDir)
	}
	if ha.ClusterID == nil || *ha.ClusterID != "my-cluster" {
		t.Errorf("clusterId = %v, want my-cluster", ha.ClusterID)
	}
}

func TestMapHAStatus_Disabled(t *testing.T) {
	t.Parallel()

	// A leftover storageDir must not be surfaced when HA is disabled.
	cfg := []flink.JMConfigEntry{
		{Key: "high-availability.type", Value: "NONE"},
		{Key: "high-availability.storageDir", Value: "s3://leftover"},
	}

	ha := mapHAStatus(cfg)
	if ha == nil || ha.Enabled {
		t.Fatalf("expected disabled HA, got %+v", ha)
	}
	if ha.Mode != "NONE" {
		t.Errorf("mode = %q, want NONE", ha.Mode)
	}
	if ha.StorageDir != nil || ha.ClusterID != nil {
		t.Errorf("disabled HA must not expose storageDir/clusterId: %+v", ha)
	}
}

func TestMapHAStatus_LegacyKeyFallback(t *testing.T) {
	t.Parallel()

	cfg := []flink.JMConfigEntry{
		{Key: "high-availability", Value: "zookeeper"}, // legacy pre-2.0 key
		{Key: "high-availability.storageDir", Value: "hdfs:///ha"},
	}

	ha := mapHAStatus(cfg)
	if ha == nil || !ha.Enabled {
		t.Fatalf("expected enabled HA via legacy key, got %+v", ha)
	}
	if ha.Mode != "zookeeper" {
		t.Errorf("mode = %q, want zookeeper", ha.Mode)
	}
	if ha.StorageDir == nil || *ha.StorageDir != "hdfs:///ha" {
		t.Errorf("storageDir = %v, want hdfs:///ha", ha.StorageDir)
	}
}

func TestMapHAStatus_EmptyConfig(t *testing.T) {
	t.Parallel()

	ha := mapHAStatus(nil)
	if ha == nil || ha.Enabled || ha.Mode != "NONE" {
		t.Fatalf("empty config should be disabled NONE, got %+v", ha)
	}
}
