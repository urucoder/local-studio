# Coupling analysis

Ratings use **blocks** (prevents the target), **degrades** (works with material
loss), and **cosmetic**. Effort is **S/M/L** and assumes the missing mobile
protocol is first made available.

## The seven claims from issue #3

| #                            | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Severity / effort                            | Concrete blast radius                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1. Process lifetime          | **Confirmed, corrected.** Electron forks runtime `detached:false`, kills it on main exit/start timeout, and stops it with Next (`agent-runtime-server.ts`, `startAgentRuntime`; `app-server.ts`, `stopFrontendServer`; `main.ts`, `shutdown`). Production web automation also owns a child (`automation/start.mjs`). `project.mjs` only dispatches. A systemd unit exists but remains a loopback sidecar (`services/agent-runtime/systemd/local-studio-agent-runtime.service`). | blocks / M                                   | child managers, Electron recovery/quit, production start, service/container deployment, connection UX  |
| 2. Filesystem/state          | **Partly confirmed.** Electron injects data/Pi/project paths. Runtime state is host-local. However, claimed `litter-controller-id` and `litter-bridge.json` are absent. OAuth encryption is owned by Electron `safeStorage`, and project state has desktop/runtime/Next interpretations (`data-dir.ts`; both `oauth-vault.ts`; both `projects-store.ts`).                                                                                                                       | blocks / L                                   | every runtime store, settings route, Electron project/prefs stores, vault, migration/backup            |
| 3. Controller URL            | **Agent side confirmed; gateway unverified.** Saved `backendUrl/apiKey` becomes the primary controller, `/v1/models` is probed, and providers use `${url}/v1` (`pi-runtime-models.ts`, `mergeControllers`, `loadControllerModels`). Runtime does not read `BACKEND_URL`; `API_KEY` is only a default. No code proves gateway health/status/GPU/metrics calls.                                                                                                                   | degrades for agent; gateway unknown / S–M    | settings contract/API, provider generation, deployment config and credential migration                 |
| 4. Dual frontend consumption | **Materially stale.** Connectors, plugins, projects, skills, sessions, OAuth and automations now proxy over HTTP (`frontend/src/app/api/agent`; runtime `http/app.ts`). Remaining stateful imports are settings, local-agents, and controller proxy resolution. Next-host filesystem/git/directory/terminal handlers and Electron project IPC are additional bypasses.                                                                                                          | blocks / L                                   | settings/local-agents/proxy target, Next workspace routes, project IPC/UI precedence, shared contracts |
| 5. Loopback chattiness       | **Confirmed and broader.** Runtime receives `LOCAL_STUDIO_FRONTEND_BASE` for extensions; Google callback binds loopback; Chrome relay is host-local; OAuth vault is process IPC (`pi-runtime-helpers.ts`, `applyRuntimeEnvInjections`; `google-oauth-loopback.ts`; runtime `oauth-vault.ts`).                                                                                                                                                                                   | blocks / L                                   | OAuth callback/vault, extension callback contract, Chrome/CUA, browser and multi-client routing        |
| 6. Pairing                   | **Confirmed only at CLI boundary.** Electron and Next execute local `kittylitter pair`; schema requires `v/node_id/token`, permits `host_name/relay` (`kittylitter-pairing.ts`; `main.ts`; pairing route). ENOENT is inherent. This repository does not prove the binary reads any bridge file or which service it contacts.                                                                                                                                                    | blocks / M or L if protocol must be designed | external CLI/mobile contract, pairing endpoint/UI, IPC/preload, token issue/rotation/revocation        |
| 7. Gateway reachability      | **Runtime bind confirmed; gateway claim unverified.** Runtime hard-codes `127.0.0.1` and rejects non-loopback Host headers (`server.ts`; `http/app.ts`, `isLoopbackHost`). It has no client authentication. Pairing preserves optional `relay`; no advertised gateway URL exists here.                                                                                                                                                                                          | blocks, security-critical / L                | bind/config, runtime authz, TLS/ingress, every privileged route, audit/rate limiting                   |

## Additional coupling

| Coupling and evidence                                                                                                                                                                                                                                 | Severity / effort     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Missing gateway ownership.** No source, route, metadata, or protocol exists; only the external binary adapter is present.                                                                                                                           | blocks / unknown      |
| **Loopback substitutes for runtime authentication.** Host checking protects DNS rebinding but cannot identify a remote client (`http/app.ts:109-135`; systemd unit comments).                                                                         | blocks / L            |
| **Electron owns decryptability.** Standalone vault calls fail without `process.send`; Electron `safeStorage` ciphertext is machine/user bound (runtime and desktop `oauth-vault.ts`).                                                                 | blocks / M–L          |
| **Project registry has competing owners.** Electron IPC, runtime project HTTP, and Next filesystem services can refer to different filesystems (`features/agent/projects/api.ts`; both project stores; `features/agent/fs-store.ts`).                 | blocks / L            |
| **Workspace tools execute on two hosts.** Runtime owns Pi/browser/PTy routes while several Next filesystem/git/terminal routes execute locally.                                                                                                       | blocks / L            |
| **Desktop UI prefers local project IPC.** `features/agent/projects/api.ts` bypasses runtime HTTP when preload exists.                                                                                                                                 | degrades/blocks / M   |
| **Host-local capabilities move with runtime.** Shell, `gh`, browser binaries, Obsidian, home, plugins and MCP executables describe the runtime host, not the desktop (`pty-service.ts`, `github-cli.ts`, `obsidian-vault.ts`, `plugin-resources.ts`). | product decision / L  |
| **Packaged resources assume Electron layout.** Desktop injects `process.resourcesPath`; standalone uses source-relative discovery (`plugin-resources.ts`).                                                                                            | degrades / M          |
| **Settings have two authorities.** Next mutates its local file while a remote runtime would read its own file (`app/api/settings/route.ts`, `settings-service.ts`).                                                                                   | blocks / M            |
| **Frontend compiles runtime internals.** `frontend/package.json` has a `file:` dependency and Next transpiles wildcard runtime source exports (`next.config.ts`; runtime `package.json`).                                                             | degrades / M          |
| **Runtime callbacks assume one frontend.** Extension env contains one `LOCAL_STUDIO_FRONTEND_BASE`, unsuitable for multiple or remote clients (`pi-runtime-helpers.ts`).                                                                              | blocks some tools / L |
| **Stable frontend port preserves browser origin state.** `embedded-frontend.port` keeps cookies/local storage usable; changing topology needs an origin and session migration plan (`app-server.ts`).                                                 | degrades / M          |

## What is already decoupled

- Agent API forwarding has a configurable target and streams HTTP responses
  (`proxy-to-runtime.ts`).
- Controller access is already URL-based HTTP, and the controller supports
  authenticated non-loopback binding (`controller/src/config/env.ts`).
- Runtime has a standalone bundle, health endpoint, graceful signals, and a
  systemd template.
- Connector/project/plugin/skill/OAuth runtime handlers already exist over
  HTTP.

These are useful foundations, but “set a remote URL” is not viable until
authentication, Host policy, state ownership, workspace locality, OAuth, and
the unknown mobile gateway are addressed.

## Open evidence gaps

The required gateway endpoint inventory, secret model, bridge-file schema,
controller calls, and phone-agent sequence cannot be supplied honestly from
this tree. Authoritative source or protocol documentation for KittyLitter and
the `kittylitter` executable is required. Until then, all gateway blast-radius
estimates are lower bounds.
