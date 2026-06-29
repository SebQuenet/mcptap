# mcptap

> The DevTools network tab for MCP. Records every tool call locally. Leaks nothing.

`mcptap` is a **local-first observability proxy** for the [Model Context
Protocol](https://modelcontextprotocol.io). It sits transparently between an MCP client
(Claude Code, Cursor, Claude Desktop, Windsurf, VS Code) and its stdio MCP servers,
captures the full JSON-RPC traffic — arguments, results, timing — estimates the
token/context cost of each exchange, and shows it all in a local web viewer.

**Nothing ever leaves your machine.**

> ⚠️ **Status: early WIP.** The capture core (frame parsing, message classification, SQLite
> storage, transparent stdio passthrough) is built and tested. The CLI (`init` / `view`)
> and the web viewer are not wired up yet. Not usable end-to-end — yet. See the
> [roadmap](#roadmap).

## Why

MCP is everywhere, but there's no convenient, privacy-preserving way for a developer to see
**what their client actually asked a server** and **what the server actually returned** —
with full payloads, timing, and context-cost. Existing tools each miss a piece:

- **Cloud gateways / SaaS** capture traffic but ship it off your machine (and often drop the
  argument/response bodies for "privacy").
- **MCP Inspector** is a manual, single-server test client — not an always-on passthrough,
  no persistence, no cost view.
- **Security scanners** focus on threats, not day-to-day debugging and cost.

`mcptap` is the intersection: **always-on passthrough + full local payloads + per-call
token/cost + dev/debug focus + 100% local.**

## How it works

For stdio transport, `mcptap` needs no protocol logic. Your client is configured to launch
`mcptap` **instead of** the real server. `mcptap` spawns the real server as a child, pipes
stdio straight through untouched, and *tees* a copy of every framed JSON-RPC message to a
local SQLite database.

```
                       ┌─────────────── mcptap (wrapper) ───────────────┐
client  ──stdin──────▶ │  passthrough  ──stdin──▶  real MCP server      │
client  ◀──stdout───── │  passthrough  ◀─stdout──  real MCP server      │
                       │       │ tee (off the critical path)            │
                       │       ▼                                        │
                       │   parse ──▶ classify ──▶ SQLite                │
                       └────────────────────────────────────────────────┘
                                                          ▲
                                  local web viewer ───────┘ reads SQLite
```

Bytes flow client↔server untouched and on the critical path; capture happens on a copy. A
capture failure can never break the proxied session (fail-open).

## Privacy

- All captured data goes to a local SQLite file under your home directory. **No network
  egress.**
- The viewer binds to `127.0.0.1` only.
- No telemetry, no analytics, no phone-home — ever. This is a hard product invariant and a
  test target, not a marketing line.

## Roadmap

- [x] **M1 — Wrapper core**: frame parser, message classification, SQLite store,
      transparent stdio passthrough. *(done, fully tested)*
- [ ] **M2 — Pairing & cost**: request/response pairing by JSON-RPC id, durations,
      token/context-cost estimation.
- [ ] **M3 — `init`**: auto-detect client configs, route them through the wrapper,
      back up & revert.
- [ ] **M4 — Viewer**: React timeline, filters, full-payload drill-down, cost panel.
- [ ] **M5 — Polish**: `purge`, packaging, `npx mcptap`.

**v1 scope:** stdio transport only (HTTP/SSE deferred to v2). `mcptap` **observes** — it
does not enforce, block, or transform.

## Development

Requires Node.js ≥ 24 (uses the built-in `node:sqlite`).

```bash
npm install
npm test          # run the test suite (vitest)
npm run typecheck # tsc --noEmit
```

The project is built spec-first with strict TDD: every behavior has a test written and
watched to fail before the implementation exists.

## License

MIT
