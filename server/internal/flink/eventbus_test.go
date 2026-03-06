package flink

import (
	"sync"
	"testing"
	"time"
)

func TestEventBus_SubscriberReceivesEvents(t *testing.T) {
	bus := NewEventBus[string]()
	listener := bus.Subscribe()
	defer listener.Close()

	bus.Publish("hello")

	select {
	case evt := <-listener.Updates():
		if evt != "hello" {
			t.Fatalf("expected 'hello', got %q", evt)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for event")
	}
}

func TestEventBus_SlowSubscriberDoesNotBlockPublisher(t *testing.T) {
	bus := NewEventBus[int]()
	listener := bus.Subscribe()
	defer listener.Close()

	// Fill the buffer (capacity 1).
	bus.Publish(1)
	// This should not block — event is dropped for the slow subscriber.
	bus.Publish(2)

	// Only the first event should be in the channel.
	select {
	case evt := <-listener.Updates():
		if evt != 1 {
			t.Fatalf("expected 1, got %d", evt)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for event")
	}

	// Channel should be empty now (event 2 was dropped).
	select {
	case evt := <-listener.Updates():
		t.Fatalf("expected no event, got %d", evt)
	default:
		// Expected: channel empty.
	}
}

func TestEventBus_UnsubscribeRemovesListener(t *testing.T) {
	bus := NewEventBus[string]()
	listener := bus.Subscribe()

	if bus.Len() != 1 {
		t.Fatalf("expected 1 subscriber, got %d", bus.Len())
	}

	listener.Close()

	if bus.Len() != 0 {
		t.Fatalf("expected 0 subscribers, got %d", bus.Len())
	}

	// Double close should not panic.
	listener.Close()
}

func TestEventBus_MultipleSubscribers(t *testing.T) {
	bus := NewEventBus[int]()
	l1 := bus.Subscribe()
	l2 := bus.Subscribe()
	defer l1.Close()
	defer l2.Close()

	bus.Publish(42)

	for i, l := range []*Listener[int]{l1, l2} {
		select {
		case evt := <-l.Updates():
			if evt != 42 {
				t.Fatalf("listener %d: expected 42, got %d", i, evt)
			}
		case <-time.After(time.Second):
			t.Fatalf("listener %d: timed out", i)
		}
	}
}

func TestEventBus_ConcurrentSubscribePublishUnsubscribe(_ *testing.T) {
	bus := NewEventBus[int]()
	var wg sync.WaitGroup

	// Concurrent subscribers.
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			l := bus.Subscribe()
			// Read one event then close.
			<-l.Updates()
			l.Close()
		}()
	}

	// Give goroutines time to subscribe.
	time.Sleep(50 * time.Millisecond)

	// Concurrent publishes.
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(v int) {
			defer wg.Done()
			bus.Publish(v)
		}(i)
	}

	wg.Wait()
}
