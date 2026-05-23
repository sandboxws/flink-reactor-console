package flink

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// 1 MB tail-cap behavior
// ---------------------------------------------------------------------------

func TestCapStdio_BelowCap_PassesThrough(t *testing.T) {
	t.Parallel()
	const body = "hello world\n"
	got := capStdio(body)
	if got != body {
		t.Errorf("capStdio mutated body below cap: got %q, want %q", got, body)
	}
}

func TestCapStdio_AtCap_PassesThrough(t *testing.T) {
	t.Parallel()
	body := strings.Repeat("x", StdioMaxBytes)
	got := capStdio(body)
	if got != body {
		t.Errorf("capStdio mutated body at exact cap (len=%d)", len(got))
	}
}

func TestCapStdio_AboveCap_TailTruncatesWithPrefix(t *testing.T) {
	t.Parallel()
	// 5 MB body. Make the trailing 1 MB recognizable so we can verify it's preserved.
	body := strings.Repeat("a", 4*StdioMaxBytes) + strings.Repeat("z", StdioMaxBytes)

	got := capStdio(body)

	if !strings.HasPrefix(got, StdioTruncatedPrefix) {
		t.Fatalf("expected truncation prefix %q, got prefix %q", StdioTruncatedPrefix, got[:min(40, len(got))])
	}
	tail := strings.TrimPrefix(got, StdioTruncatedPrefix)
	if len(tail) != StdioMaxBytes {
		t.Errorf("tail length = %d, want %d", len(tail), StdioMaxBytes)
	}
	// The retained content must be the *last* 1 MB of the original body — all 'z'.
	if strings.Count(tail, "z") != StdioMaxBytes {
		t.Errorf("tail content does not match last 1 MB of original body")
	}
}

func TestService_GetJobManagerStdout_CapsLargeResponse(t *testing.T) {
	t.Parallel()
	// Build a 1.5 MB response so we don't bloat test memory.
	largeBody := strings.Repeat("a", StdioMaxBytes/2) + strings.Repeat("z", StdioMaxBytes)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/jobmanager/stdout" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte(largeBody))
	}))
	defer srv.Close()

	svc := NewService(NewClient(WithBaseURL(srv.URL)))
	out, err := svc.GetJobManagerStdout(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasPrefix(out, StdioTruncatedPrefix) {
		t.Errorf("expected truncation prefix, got len=%d head=%q", len(out), out[:min(40, len(out))])
	}
	if len(strings.TrimPrefix(out, StdioTruncatedPrefix)) != StdioMaxBytes {
		t.Errorf("tail length = %d, want %d", len(strings.TrimPrefix(out, StdioTruncatedPrefix)), StdioMaxBytes)
	}
}

// ---------------------------------------------------------------------------
// TM ID URL encoding
// ---------------------------------------------------------------------------

func TestService_TaskManagerStdout_URLEncodesID(t *testing.T) {
	t.Parallel()
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.EscapedPath()
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	svc := NewService(NewClient(WithBaseURL(srv.URL)))
	const tmID = "akka.tcp://flink@host:42/user/taskmanager"
	if _, err := svc.GetTaskManagerStdout(context.Background(), tmID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Path frame must be intact: any raw "/" inside the encoded ID would break
	// the request routing on the server side. Colons are permitted in path
	// segments per RFC 3986, so url.PathEscape leaves them alone — that's
	// fine, because Flink's router accepts them.
	wantPrefix := "/taskmanagers/"
	wantSuffix := "/stdout"
	if !strings.HasPrefix(gotPath, wantPrefix) || !strings.HasSuffix(gotPath, wantSuffix) {
		t.Fatalf("path frame wrong: got %q", gotPath)
	}
	encodedID := strings.TrimSuffix(strings.TrimPrefix(gotPath, wantPrefix), wantSuffix)
	if strings.Contains(encodedID, "/") {
		t.Errorf("TM ID slashes were not escaped — would break path routing; got %q", encodedID)
	}
	// Decoding the encoded segment must round-trip to the original ID.
	if got := mustPathUnescape(t, encodedID); got != tmID {
		t.Errorf("encoded ID does not round-trip: got %q after decode, want %q", got, tmID)
	}
}

func mustPathUnescape(t *testing.T, s string) string {
	t.Helper()
	out, err := url.PathUnescape(s)
	if err != nil {
		t.Fatalf("url.PathUnescape(%q): %v", s, err)
	}
	return out
}
