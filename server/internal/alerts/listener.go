package alerts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/store"
)

// Channel is the Postgres LISTEN channel for alert state transitions.
const Channel = "alert_state_change"

// notifyPayload mirrors the JSON shape emitted by the trigger in 009_alerts.sql.
type notifyPayload struct {
	InstanceID int64  `json:"instance_id"`
	RuleID     int64  `json:"rule_id"`
	State      string `json:"state"`
}

// Listener owns a long-lived Postgres connection on which it LISTENs for
// alert_state_change notifications. Received events are decoded, looked up,
// and re-published on the in-process EventBus that GraphQL subscriptions
// consume.
type Listener struct {
	pool   *pgxpool.Pool
	stores *store.Stores
	bus    *flink.EventBus[InstanceEvent]
	logger *slog.Logger

	cancel context.CancelFunc
}

// NewListener builds a Listener bound to the given pool, store, and bus.
func NewListener(pool *pgxpool.Pool, stores *store.Stores, bus *flink.EventBus[InstanceEvent], logger *slog.Logger) *Listener {
	return &Listener{pool: pool, stores: stores, bus: bus, logger: logger}
}

// Start spawns the LISTEN goroutine. Reconnects on connection loss.
func (l *Listener) Start(ctx context.Context) {
	ctx, l.cancel = context.WithCancel(ctx)
	go l.runLoop(ctx)
}

// Stop cancels the listener.
func (l *Listener) Stop() {
	if l.cancel != nil {
		l.cancel()
	}
}

func (l *Listener) runLoop(ctx context.Context) {
	const backoff = 2 * time.Second
	for {
		if err := l.listen(ctx); err != nil && !errors.Is(err, context.Canceled) {
			l.logger.Warn("alerts: listener disconnected, reconnecting", "error", err)
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return
			}
			continue
		}
		return
	}
}

func (l *Listener) listen(ctx context.Context) error {
	conn, err := l.pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, fmt.Sprintf("LISTEN %s", Channel)); err != nil {
		return fmt.Errorf("LISTEN: %w", err)
	}

	for {
		notification, err := conn.Conn().WaitForNotification(ctx)
		if err != nil {
			return fmt.Errorf("wait for notification: %w", err)
		}

		var p notifyPayload
		if err := json.Unmarshal([]byte(notification.Payload), &p); err != nil {
			l.logger.Warn("alerts: bad NOTIFY payload", "raw", notification.Payload, "error", err)
			continue
		}

		inst, err := l.stores.Alerts.GetInstance(ctx, p.InstanceID)
		if err != nil {
			l.logger.Warn("alerts: lookup instance after NOTIFY failed", "instance_id", p.InstanceID, "error", err)
			continue
		}

		kind := EventStateChanged
		switch p.State {
		case "FIRING":
			kind = EventFired
		case "RESOLVED":
			kind = EventResolved
		}
		l.bus.Publish(InstanceEvent{Kind: kind, Instance: *inst})
	}
}
