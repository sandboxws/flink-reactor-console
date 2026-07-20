#!/usr/bin/env node
// stdio entry point for the FlinkReactor language server.
//
// LSP clients (the VS Code extension, IntelliJ shell, Neovim) spawn this
// binary and speak LSP over the process's stdin/stdout. The actual server
// lives in `dist/server.js`; this launcher just starts it on the stdio
// transport. For in-process embedding, import `createServer()` from the
// package entry instead of spawning this binary.
import { startServer } from "../dist/server.js"

startServer()
