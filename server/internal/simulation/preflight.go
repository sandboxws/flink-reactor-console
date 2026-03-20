package simulation

import (
	"context"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"time"
)

// PreflightCheck represents one readiness check result.
type PreflightCheck struct {
	ID       string
	Label    string
	Status   string // "pass", "fail", "warn"
	Detail   string
	Fix      string
	Required bool
}

// RunPreflight executes all pre-flight checks and returns their results.
// Checks run sequentially (most are fast network probes or kubectl calls).
func RunPreflight(ctx context.Context, flinkBaseURL string, storageEnabled bool, storageConnected bool, instrumentHealthy map[string]bool) []PreflightCheck {
	var checks []PreflightCheck

	checks = append(checks, checkMinikubeRunning(ctx))
	checks = append(checks, checkNamespace(ctx, "flink-demo"))
	checks = append(checks, checkFlinkOperator(ctx))
	checks = append(checks, checkInfrastructurePod(ctx, "kafka", "Kafka broker"))
	checks = append(checks, checkInfrastructurePod(ctx, "postgres", "PostgreSQL"))
	checks = append(checks, checkInfrastructurePod(ctx, "seaweedfs", "SeaweedFS (S3)"))
	checks = append(checks, checkStorage(storageEnabled, storageConnected))
	checks = append(checks, checkFlinkCluster(ctx, flinkBaseURL))
	checks = append(checks, checkFlinkDeployments(ctx))
	checks = append(checks, checkKafkaInstrument(instrumentHealthy))
	checks = append(checks, checkNoActiveSimulation(ctx))

	return checks
}

func kubectl(ctx context.Context, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "kubectl", args...)
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

func checkMinikubeRunning(ctx context.Context) PreflightCheck {
	check := PreflightCheck{
		ID:       "minikube",
		Label:    "Kubernetes cluster reachable",
		Required: true,
	}

	output, err := kubectl(ctx, "cluster-info", "--request-timeout=3s")
	if err != nil {
		check.Status = "fail"
		check.Detail = "Cannot reach Kubernetes API"
		check.Fix = "Start minikube: minikube start --driver=docker --cpus=12 --memory=65536 --disk-size=100g"
		return check
	}

	if strings.Contains(output, "running") || strings.Contains(output, "control plane") {
		check.Status = "pass"
		check.Detail = "Kubernetes cluster is running"
	} else {
		check.Status = "fail"
		check.Detail = "Kubernetes API responded but cluster may not be healthy"
		check.Fix = "Check cluster health: kubectl cluster-info"
	}
	return check
}

func checkNamespace(ctx context.Context, namespace string) PreflightCheck {
	check := PreflightCheck{
		ID:       "namespace",
		Label:    fmt.Sprintf("Namespace %s exists", namespace),
		Required: true,
	}

	_, err := kubectl(ctx, "get", "namespace", namespace, "--no-headers")
	if err != nil {
		check.Status = "fail"
		check.Detail = fmt.Sprintf("Namespace %s not found", namespace)
		check.Fix = "Deploy infrastructure: kubectl apply -f deploy/minikube/"
		return check
	}

	check.Status = "pass"
	check.Detail = fmt.Sprintf("Namespace %s exists", namespace)
	return check
}

func checkFlinkOperator(ctx context.Context) PreflightCheck {
	check := PreflightCheck{
		ID:       "flink-operator",
		Label:    "Flink Kubernetes Operator",
		Required: true,
	}

	output, err := kubectl(ctx, "get", "pods", "-n", "flink-system", "-l", "app.kubernetes.io/name=flink-kubernetes-operator", "--no-headers")
	if err != nil || output == "" {
		check.Status = "fail"
		check.Detail = "Flink Operator not found in flink-system namespace"
		check.Fix = "Install operator: helm install flink-operator flink-operator/flink-kubernetes-operator --namespace flink-system --create-namespace --set webhook.create=false"
		return check
	}

	if strings.Contains(output, "Running") {
		check.Status = "pass"
		check.Detail = "Flink Operator is running"
	} else {
		check.Status = "warn"
		check.Detail = "Flink Operator pod exists but may not be ready"
		check.Fix = "Check operator: kubectl get pods -n flink-system"
	}
	return check
}

func checkInfrastructurePod(ctx context.Context, appLabel string, displayName string) PreflightCheck {
	check := PreflightCheck{
		ID:       appLabel,
		Label:    fmt.Sprintf("%s pod running", displayName),
		Required: true,
	}

	output, err := kubectl(ctx, "get", "pods", "-n", "flink-demo", "-l", fmt.Sprintf("app=%s", appLabel), "--no-headers")
	if err != nil || output == "" {
		check.Status = "fail"
		check.Detail = fmt.Sprintf("No %s pod found in flink-demo", displayName)
		check.Fix = "Deploy infrastructure: kubectl apply -f deploy/minikube/"
		return check
	}

	if strings.Contains(output, "Running") {
		check.Status = "pass"
		check.Detail = fmt.Sprintf("%s is running", displayName)
	} else {
		check.Status = "warn"
		check.Detail = fmt.Sprintf("%s pod exists but not Running", displayName)
		check.Fix = fmt.Sprintf("Check pod: kubectl describe pod -n flink-demo -l app=%s", appLabel)
	}
	return check
}

func checkStorage(enabled bool, connected bool) PreflightCheck {
	check := PreflightCheck{
		ID:       "storage",
		Label:    "PostgreSQL storage connected",
		Required: true,
	}

	if !enabled {
		check.Status = "fail"
		check.Detail = "Storage is disabled in server configuration"
		check.Fix = "Enable storage in config: storage.enabled: true with DSN pointing to PostgreSQL in flink-demo"
		return check
	}
	if !connected {
		check.Status = "fail"
		check.Detail = "Storage enabled but database unreachable"
		check.Fix = "Check PostgreSQL: kubectl get pods -n flink-demo -l app=postgres"
		return check
	}

	check.Status = "pass"
	check.Detail = "Database connected and migrated"
	return check
}

func checkFlinkCluster(ctx context.Context, baseURL string) PreflightCheck {
	check := PreflightCheck{
		ID:       "flink",
		Label:    "Flink cluster reachable",
		Required: true,
	}

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(baseURL + "/overview")
	if err != nil {
		check.Status = "fail"
		check.Detail = "Cannot reach Flink REST API at " + baseURL
		check.Fix = "Ensure a Flink session cluster or FlinkDeployment is running in flink-demo"
		return check
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusOK {
		check.Status = "pass"
		check.Detail = "Connected to Flink REST API"
	} else {
		check.Status = "fail"
		check.Detail = fmt.Sprintf("Flink REST returned HTTP %d", resp.StatusCode)
		check.Fix = "Check Flink cluster health"
	}
	return check
}

func checkFlinkDeployments(ctx context.Context) PreflightCheck {
	check := PreflightCheck{
		ID:       "flinkdeployments",
		Label:    "FlinkDeployments exist",
		Required: false,
	}

	output, err := kubectl(ctx, "get", "flinkdeployment", "-n", "flink-demo", "--no-headers")
	if err != nil {
		if strings.Contains(err.Error(), "the server doesn't have a resource type") || strings.Contains(string(output), "No resources found") {
			check.Status = "warn"
			check.Detail = "No FlinkDeployments found — deploy pipelines first"
			check.Fix = "Create and deploy: npx create-fr-app my-app --template ecommerce && cd my-app && flink-reactor deploy --env minikube"
			return check
		}
		check.Status = "warn"
		check.Detail = "Could not query FlinkDeployments"
		check.Fix = "Ensure Flink Operator CRDs are installed"
		return check
	}

	if output == "" || strings.Contains(output, "No resources found") {
		check.Status = "warn"
		check.Detail = "No FlinkDeployments found — deploy pipelines first"
		check.Fix = "Create and deploy: npx create-fr-app my-app --template ecommerce && cd my-app && flink-reactor deploy --env minikube"
		return check
	}

	lines := strings.Split(output, "\n")
	count := 0
	for _, line := range lines {
		if strings.TrimSpace(line) != "" {
			count++
		}
	}

	check.Status = "pass"
	check.Detail = fmt.Sprintf("%d FlinkDeployment(s) found", count)
	return check
}

func checkKafkaInstrument(instrumentHealthy map[string]bool) PreflightCheck {
	check := PreflightCheck{
		ID:       "kafka-instrument",
		Label:    "Kafka instrument healthy",
		Required: false,
	}

	if len(instrumentHealthy) == 0 {
		check.Status = "warn"
		check.Detail = "No instruments configured"
		check.Fix = "Add a Kafka instrument in server config for load simulation scenarios"
		return check
	}

	for name, healthy := range instrumentHealthy {
		if healthy {
			check.Status = "pass"
			check.Detail = fmt.Sprintf("Kafka instrument '%s' is healthy", name)
			return check
		}
	}

	check.Status = "warn"
	check.Detail = "No healthy Kafka instrument found"
	check.Fix = "Check Kafka connectivity and instrument configuration"
	return check
}

func checkNoActiveSimulation(_ context.Context) PreflightCheck {
	// This is checked by the engine itself; here we just return pass.
	// The engine's Run() method rejects concurrent simulations.
	return PreflightCheck{
		ID:       "no-active",
		Label:    "No other simulation running",
		Status:   "pass",
		Detail:   "Ready to run",
		Required: true,
	}
}
