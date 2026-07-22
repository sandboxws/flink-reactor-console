package k8s

import "testing"

func TestOOMKillsFromPods(t *testing.T) {
	mkPod := func(name string, cs ...containerStatus) pod {
		var p pod
		p.Metadata.Name = name
		p.Status.ContainerStatuses = cs
		return p
	}
	term := func(reason string, code int32) containerState {
		return containerState{Terminated: &terminatedState{Reason: reason, ExitCode: code}}
	}

	pods := []pod{
		// OOMKilled reported in the current state.
		mkPod("tm-0", containerStatus{
			Name: "flink-main-container", RestartCount: 1, State: term("OOMKilled", 137),
		}),
		// Exit code 137 in lastState (container already restarted after the OOM).
		mkPod("tm-1", containerStatus{
			Name: "flink-main-container", RestartCount: 2, LastState: term("Error", 137),
		}),
		// Normal termination — not an OOM.
		mkPod("tm-2", containerStatus{
			Name: "flink-main-container", RestartCount: 0, LastState: term("Completed", 0),
		}),
		// Running — no terminated state at all.
		mkPod("tm-3", containerStatus{Name: "flink-main-container", RestartCount: 0}),
	}

	kills := oomKillsFromPods(pods)
	if len(kills) != 2 {
		t.Fatalf("expected 2 OOM kills, got %d: %#v", len(kills), kills)
	}

	byPod := make(map[string]OOMKill, len(kills))
	for _, k := range kills {
		byPod[k.Pod] = k
	}
	if k := byPod["tm-0"]; k.Reason != "OOMKilled" || k.RestartCount != 1 {
		t.Errorf("tm-0 kill wrong: %#v", k)
	}
	if k := byPod["tm-1"]; k.ExitCode != 137 || k.RestartCount != 2 {
		t.Errorf("tm-1 kill wrong: %#v", k)
	}
}
