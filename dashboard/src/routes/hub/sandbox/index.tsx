/**
 * Transient redirect from /hub/sandbox → /hub/primitive-sandbox.
 *
 * The kitchen-sink primitive demo lived at /hub/sandbox in P0-P3. P4 (this
 * change) moved it to /hub/primitive-sandbox so the user-facing DSL editor
 * could take /hub/sandbox/editor. This redirect preserves bookmarks for
 * one release; it is removed at cutover (`fr-console-hub-cutover`).
 *
 * NOTE: spec called for `/hub/__primitive-sandbox` but TanStack Router's
 * file-based plugin treats `__`-prefixed siblings as conflicting pathless
 * routes (`__shell-test.tsx` already occupies that slot under /hub). The
 * single-underscore path satisfies the spec intent (free up /hub/sandbox/*
 * for the DSL editor) without the routing collision.
 */

import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/hub/sandbox/")({
  component: () => <Navigate to="/hub/primitive-sandbox" replace />,
})
