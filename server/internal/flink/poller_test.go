package flink

import (
	"context"
	"sync"
	"testing"
	"time"
)

// mockJobGetter returns canned job overview responses.
type mockJobGetter struct {
	mu       sync.Mutex
	response *JobsOverview
}

func (m *mockJobGetter) GetJobs(_ context.Context) (*JobsOverview, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.response, nil
}

func (m *mockJobGetter) set(jobs []JobOverview) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.response = &JobsOverview{Jobs: jobs}
}

func TestPoller_DetectsStatusTransition(t *testing.T) {
	mock := &mockJobGetter{}
	mock.set([]JobOverview{
		{JID: "j1", Name: "job1", State: "RUNNING"},
	})

	p := NewPoller(mock, WithPollInterval(20*time.Millisecond))
	listener := p.Subscribe()
	defer listener.Close()

	// First poll: new job detected.
	evt := readEvent(t, listener, time.Second)
	if evt.JobID != "j1" || evt.CurrentStatus != "RUNNING" || evt.PreviousStatus != nil {
		t.Fatalf("unexpected first event: %+v", evt)
	}

	// Change status.
	mock.set([]JobOverview{
		{JID: "j1", Name: "job1", State: "FAILED"},
	})

	// Second event: status transition.
	evt = readEvent(t, listener, time.Second)
	if evt.JobID != "j1" || evt.CurrentStatus != "FAILED" {
		t.Fatalf("unexpected event: %+v", evt)
	}
	if evt.PreviousStatus == nil || *evt.PreviousStatus != "RUNNING" {
		t.Fatalf("expected previous status RUNNING, got %v", evt.PreviousStatus)
	}
}

func TestPoller_DetectsNewJob(t *testing.T) {
	mock := &mockJobGetter{}
	mock.set([]JobOverview{})

	p := NewPoller(mock, WithPollInterval(20*time.Millisecond))
	listener := p.Subscribe()
	defer listener.Close()

	// No events yet (empty job list).
	time.Sleep(50 * time.Millisecond)

	// Add a new job.
	mock.set([]JobOverview{
		{JID: "j2", Name: "newjob", State: "CREATED"},
	})

	evt := readEvent(t, listener, time.Second)
	if evt.JobID != "j2" || evt.CurrentStatus != "CREATED" || evt.PreviousStatus != nil {
		t.Fatalf("unexpected event: %+v", evt)
	}
}

func TestPoller_MultipleChangesInOnePoll(t *testing.T) {
	mock := &mockJobGetter{}
	mock.set([]JobOverview{
		{JID: "j1", Name: "job1", State: "RUNNING"},
		{JID: "j2", Name: "job2", State: "RUNNING"},
	})

	p := NewPoller(mock, WithPollInterval(20*time.Millisecond))
	listener := p.Subscribe()
	defer listener.Close()

	// Drain initial "new job" events.
	readEvent(t, listener, time.Second)
	readEvent(t, listener, time.Second)

	// Change both jobs.
	mock.set([]JobOverview{
		{JID: "j1", Name: "job1", State: "FINISHED"},
		{JID: "j2", Name: "job2", State: "FAILED"},
	})

	events := make(map[string]JobStatusEvent)
	events[readEvent(t, listener, time.Second).JobID] = JobStatusEvent{}
	evt2 := readEvent(t, listener, time.Second)
	events[evt2.JobID] = evt2

	if len(events) != 2 {
		t.Fatalf("expected 2 distinct job events, got %d", len(events))
	}
}

func TestPoller_StopsWhenNoSubscribers(t *testing.T) {
	mock := &mockJobGetter{}
	mock.set([]JobOverview{})

	p := NewPoller(mock, WithPollInterval(20*time.Millisecond))

	l1 := p.Subscribe()
	l2 := p.Subscribe()

	if p.SubscriberCount() != 2 {
		t.Fatalf("expected 2 subscribers, got %d", p.SubscriberCount())
	}

	l1.Close()
	if p.SubscriberCount() != 1 {
		t.Fatalf("expected 1 subscriber, got %d", p.SubscriberCount())
	}

	l2.Close()
	if p.SubscriberCount() != 0 {
		t.Fatalf("expected 0 subscribers, got %d", p.SubscriberCount())
	}

	// Poller should have stopped (cancel called). Verify by checking
	// that subscribing again starts a fresh poller without panic.
	l3 := p.Subscribe()
	defer l3.Close()
	if p.SubscriberCount() != 1 {
		t.Fatalf("expected 1 subscriber after re-subscribe, got %d", p.SubscriberCount())
	}
}

func readEvent(t *testing.T, l *PollerListener, timeout time.Duration) JobStatusEvent {
	t.Helper()
	select {
	case evt := <-l.Updates():
		return evt
	case <-time.After(timeout):
		t.Fatal("timed out waiting for event")
		return JobStatusEvent{}
	}
}
