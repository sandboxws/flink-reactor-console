package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// NOTE: This file is UNVERIFIED against a live Kubernetes cluster. The pod
// listing is written from the client-go/dynamic API and the pod JSON shape, but
// has not been exercised against a running API server. The pure OOM-detection
// logic (oomKillsFromPods) IS unit-tested. Validate the listing against a real
// cluster before relying on it. See the OOMKill notes in the plan/commit.

// podsGVR is the GroupVersionResource for core/v1 Pods.
var podsGVR = schema.GroupVersionResource{Group: "", Version: "v1", Resource: "pods"}

// taskManagerLabelSelector selects Flink TaskManager pods created by the Flink
// Kubernetes operator (which labels TM pods with component=taskmanager).
const taskManagerLabelSelector = "component=taskmanager"

// oomExitCode is the conventional exit code for an OOM-killed process
// (128 + SIGKILL(9)); Kubernetes reports it on OOM container terminations.
const oomExitCode int32 = 137

// pod is the minimal slice of a core/v1 Pod parsed from the dynamic client.
type pod struct {
	Metadata struct {
		Name   string            `json:"name"`
		Labels map[string]string `json:"labels"`
	} `json:"metadata"`
	Status struct {
		ContainerStatuses []containerStatus `json:"containerStatuses"`
	} `json:"status"`
}

type containerStatus struct {
	Name         string         `json:"name"`
	RestartCount int            `json:"restartCount"`
	State        containerState `json:"state"`
	LastState    containerState `json:"lastState"`
}

type containerState struct {
	Terminated *terminatedState `json:"terminated"`
}

type terminatedState struct {
	Reason     string    `json:"reason"`
	ExitCode   int32     `json:"exitCode"`
	FinishedAt time.Time `json:"finishedAt"`
}

// OOMKill records a single OOM termination of a TaskManager container.
type OOMKill struct {
	Pod          string
	Container    string
	RestartCount int
	ExitCode     int32
	Reason       string
	FinishedAt   time.Time
}

// oomKillsFromPods scans pod container statuses for terminations that indicate
// an out-of-memory kill (reason "OOMKilled" or exit code 137), in either the
// current or the previous container state. It returns one OOMKill per affected
// container; callers dedup across polls by (pod, container) on the restart count.
func oomKillsFromPods(pods []pod) []OOMKill {
	var out []OOMKill
	for _, p := range pods {
		for _, cs := range p.Status.ContainerStatuses {
			term := oomTermination(cs.State.Terminated)
			if term == nil {
				term = oomTermination(cs.LastState.Terminated)
			}
			if term == nil {
				continue
			}
			out = append(out, OOMKill{
				Pod:          p.Metadata.Name,
				Container:    cs.Name,
				RestartCount: cs.RestartCount,
				ExitCode:     term.ExitCode,
				Reason:       term.Reason,
				FinishedAt:   term.FinishedAt,
			})
		}
	}
	return out
}

// oomTermination returns t when it represents an OOM kill, else nil.
func oomTermination(t *terminatedState) *terminatedState {
	if t == nil {
		return nil
	}
	if t.Reason == "OOMKilled" || t.ExitCode == oomExitCode {
		return t
	}
	return nil
}

// listTaskManagerPods lists Flink TaskManager pods in the configured namespace.
func (c *Client) listTaskManagerPods(ctx context.Context) ([]pod, error) {
	list, err := c.Dynamic.Resource(podsGVR).Namespace(c.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: taskManagerLabelSelector,
	})
	if err != nil {
		return nil, fmt.Errorf("listing task manager pods: %w", err)
	}

	data, err := list.MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("marshaling pod list: %w", err)
	}

	var parsed struct {
		Items []pod `json:"items"`
	}
	if err := json.Unmarshal(data, &parsed); err != nil {
		return nil, fmt.Errorf("parsing pod list: %w", err)
	}
	return parsed.Items, nil
}
