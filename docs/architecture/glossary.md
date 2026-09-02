# Glossary

- **Agent runtime:** Local Studio's Hono service around Pi sessions, tools,
  connectors, browser, PTY, and state. Not an inference engine.
- **Controller:** Bun/Hono service that manages hardware, models, inference
  processes, usage, and OpenAI-compatible APIs.
- **Electron main process:** trusted desktop Node process that owns windows,
  child processes, OS APIs, and IPC handlers.
- **Renderer:** the sandboxed Chromium page displaying the Next/React UI.
- **Preload:** context-isolated adapter exposing a typed subset of Electron IPC
  to the renderer.
- **Hono:** small web framework used to register HTTP middleware and routes in
  both controller and agent runtime.
- **Inference runtime/engine:** model server supervised by the controller, such
  as vLLM, SGLang, llama.cpp, or MLX.
- **Pi:** `@earendil-works/pi-coding-agent`, the library that executes coding
  sessions and stores native JSONL transcripts.
- **Proxy route:** same-origin Next route that forwards HTTP to another
  process. `/api/agent/*` targets agent runtime; `/api/proxy/*` targets a
  controller.
- **In-process import:** Next loads a runtime source module into its own process
  instead of calling the runtime service.
- **Loopback:** host-only network addresses such as `127.0.0.1`, `localhost`,
  and `::1`; another machine cannot directly reach them.
- **Relay:** an intermediary that carries traffic between otherwise
  unreachable peers. Pairing permits a `relay` JSON field, but its semantics
  are not defined in this repository.
- **Gateway / Litter bridge:** mobile-facing service described by issue #3.
  Its implementation and endpoint surface are absent from this checkout.
- **Pairing:** bootstrap in which `kittylitter pair` emits
  `{v,node_id,token,host_name?,relay?}` and the UI renders it as a QR code.
- **Connector:** MCP server definition and transport made available to agent
  sessions under per-model grants.
- **Plugin / skill:** Pi extension code / instructional resource discovered
  from packaged and user directories.
- **OAuth loopback:** authorization pattern where the provider redirects a
  browser to a temporary server on `127.0.0.1`.
- **Data dir:** durable root selected independently by controller and agent
  runtime; Electron currently points runtime at its `userData`.
- **Trust boundary:** point where data or control crosses between principals or
  processes and therefore needs validation, authentication, and authorization.
