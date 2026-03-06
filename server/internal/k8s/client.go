package k8s

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// GVR is the GroupVersionResource for FlinkBlueGreenDeployment CRDs.
var GVR = schema.GroupVersionResource{
	Group:    "flink.apache.org",
	Version:  "v1beta1",
	Resource: "flinkbluegreendeployments",
}

// Client wraps a Kubernetes dynamic client for accessing Flink CRDs.
type Client struct {
	Dynamic   dynamic.Interface
	Namespace string
	Logger    *slog.Logger
}

// ClientOptions configures how the K8s client connects.
type ClientOptions struct {
	// Kubeconfig is the path to the kubeconfig file. Empty = auto-detect.
	Kubeconfig string
	// Context is the kubeconfig context to use. Empty = current context.
	Context string
	// Namespace to watch. Empty = "default".
	Namespace string
	// Logger for client operations.
	Logger *slog.Logger
}

// NewClient creates a new K8s client from the given options.
// It tries in-cluster config first, then falls back to kubeconfig.
func NewClient(opts ClientOptions) (*Client, error) {
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}

	namespace := opts.Namespace
	if namespace == "" {
		namespace = "default"
	}

	cfg, err := buildConfig(opts)
	if err != nil {
		return nil, fmt.Errorf("building k8s config: %w", err)
	}

	dynClient, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("creating dynamic client: %w", err)
	}

	logger.Info("k8s client initialized", "namespace", namespace)

	return &Client{
		Dynamic:   dynClient,
		Namespace: namespace,
		Logger:    logger,
	}, nil
}

func buildConfig(opts ClientOptions) (*rest.Config, error) {
	// Try in-cluster first
	cfg, err := rest.InClusterConfig()
	if err == nil {
		return cfg, nil
	}

	// Fall back to kubeconfig
	kubeconfigPath := opts.Kubeconfig
	if kubeconfigPath == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("getting home dir: %w", err)
		}
		kubeconfigPath = filepath.Join(home, ".kube", "config")
	}

	loadingRules := &clientcmd.ClientConfigLoadingRules{
		ExplicitPath: kubeconfigPath,
	}
	overrides := &clientcmd.ConfigOverrides{}
	if opts.Context != "" {
		overrides.CurrentContext = opts.Context
	}

	return clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		loadingRules,
		overrides,
	).ClientConfig()
}

// ListBlueGreenDeployments lists all FlinkBlueGreenDeployment CRDs in the namespace.
func (c *Client) ListBlueGreenDeployments(ctx context.Context) ([]BlueGreenDeployment, error) {
	list, err := c.Dynamic.Resource(GVR).Namespace(c.Namespace).List(ctx, listOptions())
	if err != nil {
		return nil, fmt.Errorf("listing FlinkBlueGreenDeployments: %w", err)
	}

	data, err := list.MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("marshaling list response: %w", err)
	}

	return ParseBlueGreenDeploymentList(data)
}

// GetBlueGreenDeployment gets a single FlinkBlueGreenDeployment by name.
func (c *Client) GetBlueGreenDeployment(ctx context.Context, name string) (*BlueGreenDeployment, error) {
	obj, err := c.Dynamic.Resource(GVR).Namespace(c.Namespace).Get(ctx, name, getOptions())
	if err != nil {
		return nil, fmt.Errorf("getting FlinkBlueGreenDeployment %q: %w", name, err)
	}

	data, err := obj.MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("marshaling response: %w", err)
	}

	return ParseBlueGreenDeployment(data)
}
