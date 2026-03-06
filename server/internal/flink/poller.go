package flink

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

const defaultPollInterval = 2 * time.Second

// JobGetter abstracts the method the poller needs from Service.
type JobGetter interface {
	GetJobs(ctx context.Context) (*JobsOverview, error)
}

// PollerOption configures a Poller.
type PollerOption func(*Poller)

// WithPollInterval sets the polling interval.
func WithPollInterval(d time.Duration) PollerOption {
	return func(p *Poller) { p.interval = d }
}

// WithPollerLogger sets the logger for the poller.
func WithPollerLogger(l *slog.Logger) PollerOption {
	return func(p *Poller) { p.logger = l }
}

// PollerListener wraps an EventBus listener with ref-counting for the poller.
// Call Close to unsubscribe and potentially stop the poller.
type PollerListener struct {
	inner *Listener[JobStatusEvent]
	p     *Poller
	once  sync.Once
}

// Updates returns the channel that delivers job status events.
func (pl *PollerListener) Updates() <-chan JobStatusEvent {
	return pl.inner.Updates()
}

// Close unsubscribes from the event bus and decrements the poller's
// subscriber count. If this was the last subscriber, the poller stops.
func (pl *PollerListener) Close() {
	pl.once.Do(func() {
		pl.inner.Close()
		pl.p.unsubscribe()
	})
}

// Poller polls the Flink job overview endpoint and publishes JobStatusEvent
// values when job statuses change. It starts lazily on the first subscriber
// and stops when the last subscriber disconnects.
type Poller struct {
	getter   JobGetter
	interval time.Duration
	logger   *slog.Logger

	bus *EventBus[JobStatusEvent]

	mu     sync.Mutex
	cancel context.CancelFunc
	subs   int
}

// NewPoller creates a Poller that polls via the given JobGetter.
func NewPoller(getter JobGetter, opts ...PollerOption) *Poller {
	p := &Poller{
		getter:   getter,
		interval: defaultPollInterval,
		logger:   slog.Default(),
		bus:      NewEventBus[JobStatusEvent](),
	}
	for _, o := range opts {
		o(p)
	}
	return p
}

// Subscribe registers a listener for job status events. The poller starts
// automatically on the first subscriber.
func (p *Poller) Subscribe() *PollerListener {
	p.mu.Lock()
	defer p.mu.Unlock()

	listener := p.bus.Subscribe()
	p.subs++

	if p.subs == 1 {
		p.startLocked()
	}

	return &PollerListener{inner: listener, p: p}
}

// SubscriberCount returns the number of active subscribers.
func (p *Poller) SubscriberCount() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.subs
}

// Stop stops the poller unconditionally.
func (p *Poller) Stop() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.stopLocked()
}

func (p *Poller) unsubscribe() {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.subs--
	if p.subs <= 0 {
		p.subs = 0
		p.stopLocked()
	}
}

func (p *Poller) startLocked() {
	ctx, cancel := context.WithCancel(context.Background())
	p.cancel = cancel
	go p.poll(ctx)
}

func (p *Poller) stopLocked() {
	if p.cancel != nil {
		p.cancel()
		p.cancel = nil
	}
}

func (p *Poller) poll(ctx context.Context) {
	prevStates := make(map[string]jobSnapshot)
	ticker := time.NewTicker(p.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.pollOnce(ctx, prevStates)
		}
	}
}

type jobSnapshot struct {
	name   string
	status string
}

func (p *Poller) pollOnce(ctx context.Context, prevStates map[string]jobSnapshot) {
	overview, err := p.getter.GetJobs(ctx)
	if err != nil {
		if ctx.Err() == nil {
			p.logger.Warn("poller: failed to get jobs", "error", err)
		}
		return
	}

	for _, job := range overview.Jobs {
		prev, existed := prevStates[job.JID]

		if !existed {
			prevStates[job.JID] = jobSnapshot{name: job.Name, status: job.State}
			p.bus.Publish(JobStatusEvent{
				JobID:         job.JID,
				JobName:       job.Name,
				CurrentStatus: job.State,
			})
		} else if prev.status != job.State {
			oldStatus := prev.status
			prevStates[job.JID] = jobSnapshot{name: job.Name, status: job.State}
			p.bus.Publish(JobStatusEvent{
				JobID:          job.JID,
				JobName:        job.Name,
				PreviousStatus: &oldStatus,
				CurrentStatus:  job.State,
			})
		}
	}
}
