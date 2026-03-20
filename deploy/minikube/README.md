# Minikube Simulation Infrastructure

Deploy the full flink-reactor simulation stack on a single PC.

## Prerequisites

- [minikube](https://minikube.sigs.k8s.io/docs/start/) installed
- [kubectl](https://kubernetes.io/docs/tasks/tools/) configured
- [Helm](https://helm.sh/docs/intro/install/) for Flink Operator
- Docker (used as minikube driver)

## Quick Start

### 1. Start minikube

```bash
minikube start \
  --driver=docker \
  --cpus=12 \
  --memory=65536 \
  --disk-size=100g \
  --kubernetes-version=v1.31.0

minikube addons enable metrics-server
```

### 2. Install Flink Kubernetes Operator

```bash
helm repo add flink-operator https://downloads.apache.org/flink/flink-kubernetes-operator-1.11.0/
helm install flink-operator flink-operator/flink-kubernetes-operator \
  --namespace flink-system --create-namespace \
  --set webhook.create=false
```

### 3. Build custom Flink image (from flink-reactor-dsl repo)

```bash
eval $(minikube docker-env)

# Base image with Kafka + JDBC connectors
docker build -t flink-reactor:2.0.1 \
  -f /path/to/flink-reactor-dsl/src/cli/cluster/Dockerfile.flink .

# S3 plugin for SeaweedFS checkpoints
docker build -t flink-reactor-s3:2.0.1 \
  -f deploy/minikube/Dockerfile.flink-s3 .
```

### 4. Build reactor-server image (from this repo)

```bash
eval $(minikube docker-env)
pnpm build
cp -r dashboard/out/ server/dashboard/
cd server && docker build -t reactor-server:latest .
```

### 5. Deploy infrastructure

```bash
kubectl apply -f deploy/minikube/
```

Wait for all pods to be ready:

```bash
kubectl get pods -n flink-demo -w
```

### 6. Access the console

```bash
kubectl port-forward svc/reactor-server 8080:8080 -n flink-demo
```

Open http://localhost:8080

## Resource Budget

| Component | CPU | Memory |
|-----------|-----|--------|
| Flink Operator | 0.5 | 512 MB |
| Kafka (KRaft) | 1.5 | 6 GB |
| PostgreSQL | 0.5 | 2 GB |
| SeaweedFS (S3) | 0.5 | 2 GB |
| SQL Gateway | 0.25 | 512 MB |
| reactor-server | 0.2 | 256 MB |
| K8s system pods | 0.5 | 1 GB |
| **Base total** | **~4 CPU** | **~12.3 GB** |

## Shutdown & Resume

```bash
# Graceful shutdown
flink-reactor stop --all --env minikube
minikube stop

# Resume
minikube start
flink-reactor resume --all --env minikube
```

All PVCs (Kafka logs, PostgreSQL data, SeaweedFS checkpoints) survive `minikube stop`.
