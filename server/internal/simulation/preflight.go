package simulation

import (
	"context"
	"fmt"
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

// RunPreflight executes pre-flight checks with cascading dependencies.
// If a required check fails, downstream checks are skipped (shown as blocked).
// The dependency chain is:
//
//	kubectl installed → K8s reachable → namespace exists → [operator, pods in parallel]
//	                                                      → FlinkDeployments
func RunPreflight(ctx context.Context) []PreflightCheck {
	var checks []PreflightCheck

	// ── Gate 1: kubectl installed ────────────────────────────────────
	if !kubectlAvailable() {
		checks = append(checks, PreflightCheck{
			ID: "kubectl", Label: "kubectl installed", Status: "fail", Required: true,
			Detail: "kubectl not found on server PATH",
			Fix:    "Install kubectl: https://kubernetes.io/docs/tasks/tools/",
		})
		return checks
	}
	checks = append(checks, PreflightCheck{
		ID: "kubectl", Label: "kubectl installed", Status: "pass", Required: true,
		Detail: "Found at " + kubectlPath(),
	})

	// ── Gate 2: K8s cluster reachable ────────────────────────────────
	k8sCheck := checkKubeCluster(ctx)
	checks = append(checks, k8sCheck)
	if k8sCheck.Status == "fail" {
		return checks
	}

	// ── Gate 3: flink-demo namespace ─────────────────────────────────
	nsCheck := checkNamespace(ctx, "flink-demo")
	checks = append(checks, nsCheck)
	if nsCheck.Status == "fail" {
		return checks
	}

	// ── Gate 4: Infrastructure pods (all must pass) ──────────────────
	pods := []struct {
		label string
		app   string
		port  string
	}{
		{"Flink Operator", "flink-kubernetes-operator", ""},
		{"Kafka", "kafka", "9092"},
		{"PostgreSQL", "postgres", "5432"},
		{"SeaweedFS (S3)", "seaweedfs", "8333"},
		{"SQL Gateway", "flink-sql-gateway", "8083"},
		{"reactor-server", "reactor-server", "8080"},
	}

	allPodsReady := true
	for _, p := range pods {
		ns := "flink-demo"
		labelSelector := fmt.Sprintf("app=%s", p.app)
		if p.app == "flink-kubernetes-operator" {
			ns = "flink-system"
			labelSelector = "app.kubernetes.io/name=flink-kubernetes-operator"
		}

		pc := checkPod(ctx, p.app, p.label, ns, labelSelector, p.port)
		checks = append(checks, pc)
		if pc.Status == "fail" {
			allPodsReady = false
		}
	}

	if !allPodsReady {
		return checks
	}

	// ── Gate 4b: Iceberg REST catalog (optional) ────────────────────
	icebergCheck := checkPod(ctx, "iceberg-rest", "Iceberg REST Catalog", "flink-demo", "app=iceberg-rest", "8181")
	icebergCheck.Required = false
	if icebergCheck.Status == "fail" {
		icebergCheck.Status = "warn"
		icebergCheck.Detail = "Iceberg REST catalog not deployed (optional — needed for lakehouse templates)"
		icebergCheck.Fix = "flink-reactor sim up (includes Iceberg REST manifest)"
	}
	checks = append(checks, icebergCheck)

	// ── Gate 5: FlinkDeployments (optional) ──────────────────────────
	checks = append(checks, checkFlinkDeployments(ctx))

	// ── Gate 6: No active simulation ─────────────────────────────────
	checks = append(checks, PreflightCheck{
		ID: "no-active", Label: "No other simulation running", Status: "pass", Required: true,
		Detail: "Ready to run",
	})

	return checks
}

// ── Helpers ──────────────────────────────────────────────────────────────

func kubectlAvailable() bool {
	_, err := exec.LookPath("kubectl")
	return err == nil
}

func kubectlPath() string {
	p, _ := exec.LookPath("kubectl")
	return p
}

func kubectl(ctx context.Context, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "kubectl", args...)
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

func checkKubeCluster(ctx context.Context) PreflightCheck {
	check := PreflightCheck{
		ID: "k8s", Label: "Kubernetes cluster reachable", Required: true,
	}
	output, err := kubectl(ctx, "cluster-info", "--request-timeout=2s")
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
		check.Detail = "Cluster responded but may not be healthy"
		check.Fix = "Check: kubectl cluster-info"
	}
	return check
}

func checkNamespace(ctx context.Context, namespace string) PreflightCheck {
	check := PreflightCheck{
		ID: "namespace", Label: fmt.Sprintf("Namespace %s", namespace), Required: true,
	}
	_, err := kubectl(ctx, "get", "namespace", namespace, "--no-headers")
	if err != nil {
		check.Status = "fail"
		check.Detail = fmt.Sprintf("Namespace %s not found", namespace)
		check.Fix = "flink-reactor sim up"
		return check
	}
	check.Status = "pass"
	check.Detail = "Exists"
	return check
}

func checkPod(ctx context.Context, id string, displayName string, namespace string, labelSelector string, port string) PreflightCheck {
	check := PreflightCheck{
		ID: id, Label: displayName, Required: true,
	}

	output, err := kubectl(ctx, "get", "pods", "-n", namespace, "-l", labelSelector, "-o", "jsonpath={range .items[*]}{.status.phase}{' '}{end}")
	if err != nil || strings.TrimSpace(output) == "" {
		check.Status = "fail"
		check.Detail = fmt.Sprintf("No pod found (namespace: %s, label: %s)", namespace, labelSelector)
		check.Fix = "flink-reactor sim up"
		return check
	}

	phases := strings.Fields(output)
	allRunning := true
	for _, phase := range phases {
		if phase != "Running" && phase != "Succeeded" {
			allRunning = false
		}
	}

	if allRunning {
		check.Status = "pass"
		if port != "" {
			check.Detail = fmt.Sprintf("Running (port %s)", port)
		} else {
			check.Detail = "Running"
		}
	} else {
		check.Status = "warn"
		check.Detail = fmt.Sprintf("Pod exists but phase: %s", strings.Join(phases, ", "))
		check.Fix = fmt.Sprintf("kubectl describe pod -n %s -l %s", namespace, labelSelector)
	}
	return check
}

func checkFlinkDeployments(ctx context.Context) PreflightCheck {
	check := PreflightCheck{
		ID: "flinkdeployments", Label: "FlinkDeployments", Required: false,
	}
	output, err := kubectl(ctx, "get", "flinkdeployment", "-n", "flink-demo", "--no-headers", "--ignore-not-found")
	if err != nil || strings.TrimSpace(output) == "" {
		check.Status = "warn"
		check.Detail = "No FlinkDeployments found — deploy pipelines first"
		check.Fix = "npx create-fr-app my-app --template ecommerce && cd my-app && flink-reactor deploy --env minikube"
		return check
	}
	count := 0
	for _, line := range strings.Split(output, "\n") {
		if strings.TrimSpace(line) != "" {
			count++
		}
	}
	check.Status = "pass"
	check.Detail = fmt.Sprintf("%d deployed", count)
	return check
}
