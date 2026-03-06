package flink

import "sync"

// Listener receives events from an EventBus. Call Close to unsubscribe.
type Listener[T any] struct {
	ch    chan T
	bus   *EventBus[T]
	id    uint64
	close sync.Once
}

// Updates returns the channel that delivers events to this listener.
func (l *Listener[T]) Updates() <-chan T {
	return l.ch
}

// Close unsubscribes the listener from the event bus and closes the channel.
func (l *Listener[T]) Close() {
	l.close.Do(func() {
		l.bus.remove(l.id)
		close(l.ch)
	})
}

// EventBus is a generic, thread-safe, in-process pub/sub mechanism.
// Each subscriber gets a buffered channel (capacity 1). Publishes are
// non-blocking: if a subscriber's channel is full, the event is dropped
// for that subscriber only.
type EventBus[T any] struct {
	mu          sync.RWMutex
	subscribers map[uint64]chan T
	nextID      uint64
}

// NewEventBus creates a new EventBus.
func NewEventBus[T any]() *EventBus[T] {
	return &EventBus[T]{
		subscribers: make(map[uint64]chan T),
	}
}

// Subscribe registers a new listener and returns it. The listener's channel
// has a buffer of 1 to avoid blocking the publisher on slow consumers.
func (b *EventBus[T]) Subscribe() *Listener[T] {
	b.mu.Lock()
	defer b.mu.Unlock()

	id := b.nextID
	b.nextID++
	ch := make(chan T, 1)
	b.subscribers[id] = ch

	return &Listener[T]{ch: ch, bus: b, id: id}
}

// Publish sends an event to all subscribers. If a subscriber's channel is
// full, the event is dropped for that subscriber (non-blocking).
func (b *EventBus[T]) Publish(evt T) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, ch := range b.subscribers {
		select {
		case ch <- evt:
		default:
		}
	}
}

// Len returns the number of active subscribers.
func (b *EventBus[T]) Len() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.subscribers)
}

func (b *EventBus[T]) remove(id uint64) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.subscribers, id)
}
