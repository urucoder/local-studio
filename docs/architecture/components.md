# Component inventory

## Repository and packages

The root `package.json` is an orchestration package, not an npm `workspaces`
declaration. Local packages are connected with `file:` dependencies and setup
automation (`frontend/package.json`; `frontend/desktop/automation/setup.mjs`).

| Path                      | Role                                  | Depends on / output                                          |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| `controller/`             | Bun/Hono controller                   | Effect, Hono; `controller.db`, engines and model files       |
| `controller/contracts/`   | Effect Schema HTTP/domain contracts   | imported as `@local-studio/contracts`                        |
| `services/agent-runtime/` | Node/Hono Pi agent service            | Pi SDK, Hono, Effect, Playwright, MCP; `dist/standalone.mjs` |
| `frontend/`               | Next 16/React 19 UI and API facade    | controller contracts and runtime source; `.next/standalone`  |
| `frontend/desktop/`       | Electron main/preload and automation  | `desktop/dist`, electron-builder packages                    |
| `shared/`                 | shared model recommendation module    | independently versioned `0.0.0`                              |
| `shared/agent/`           | source-shared agent boundary helpers  | imported through TypeScript aliases                          |
| `scripts/`                | stable command entry and installers   | `scripts/project.mjs` dispatches to desktop automation       |
| `docs/`                   | design and architecture documentation | no runtime output                                            |

`npm run setup`, `doctor`, and `check` dispatch through
`scripts/project.mjs`, a symlink to `frontend/desktop/project.mjs`. The
dispatcher maps readable command names to modules in
`frontend/desktop/automation/`. Build and distribution commands are defined in
the root and frontend manifests.

## Frontend pages and API surface

`frontend/src/app/layout.tsx` is the root server layout. Server pages compose
feature components; interactive leaves use `"use client"`. Explicit client
page entries are `settings/page.tsx`, `setup/page.tsx`, `quick/page.tsx`, and
`logs/page.tsx`. `agent/page.tsx` and `models/page.tsx` demonstrate server
components with Suspense around interactive content.

### HTTP proxy to the agent runtime

The runtime route tree is defined once in
`services/agent-runtime/src/http/app.ts`, `createAgentRuntimeApp`. Next mirrors
it under `frontend/src/app/api/agent` and almost all routes delegate to
`proxyToAgentRuntime`:

| Runtime area                | Methods and paths                                                                |
| --------------------------- | -------------------------------------------------------------------------------- |
| execution                   | `POST turn`, `abort`, `compact`; runtime status/events/sessions/extension UI     |
| sessions                    | `GET/DELETE sessions`, `GET sessions/all`, `GET/PATCH sessions/:id`, change SSE  |
| models/providers            | `GET/POST models`; provider list, login job/respond/cancel, logout               |
| automations/goals/subagents | automation CRUD/run; goal GET/PUT/DELETE; subagent list/run/get/stop             |
| connectors/OAuth            | connector CRUD/call/test/grants/SSH path; generic OAuth and Google account flows |
| projects/discovery          | project list/add/remove; plugins/source; skills/load; prompt templates/load      |
| workspace tools             | PR, PTY, browser state/input/history/engine/viewport/fetch                       |

Some Next-only workspace handlers remain under `/api/agent`: filesystem,
comments, directories, git, raw terminal, and CWD resolution. They execute on
the **Next host**, not necessarily the runtime host
(`frontend/src/app/api/agent/fs`; `git`; `directories`; `terminal/route.ts`).
That distinction is a remote-runtime coupling.

### In-process or other Next handlers

- `/api/settings` imports runtime `settings-service` and reads/writes the
  Next host's data dir.
- `/api/local-agents` imports the same settings and emits local Pi provider
  configuration.
- `/api/proxy/[...path]` imports runtime settings to select a controller, then
  proxies controller HTTP.
- `/api/kittylitter/pairing` imports Electron pairing logic and executes an
  external binary.
- `/api/bootstrap`, `/health`, `/desktop-health`, `/auth/session`,
  `/app-update`, `/setup/recommendations`, and `/huggingface/*` are local
  framework/integration endpoints.

This is the current, narrower version of “dual consumption”; connectors,
plugins, projects, and skills have already moved to HTTP.

## Electron inventory

| Concern              | Evidence                                                                 |
| -------------------- | ------------------------------------------------------------------------ |
| entry/lifecycle      | `frontend/desktop/main.ts`: `run`, `bootstrap`, `shutdown`               |
| Next child           | `logic/app-server.ts`: `startFrontendServer`, `stopFrontendServer`       |
| agent child          | `logic/agent-runtime-server.ts`: `startAgentRuntime`, `stopAgentRuntime` |
| windows              | `logic/window-manager.ts`, `logic/quick-panel-window.ts`                 |
| trust/navigation     | `logic/security.ts`                                                      |
| pairing              | `logic/kittylitter-pairing.ts`                                           |
| OAuth encryption     | `logic/oauth-vault.ts`, Electron `safeStorage`                           |
| projects/preferences | `logic/projects-store.ts`, `desktop-settings.ts`                         |
| native terminal      | `logic/pty-manager.ts`                                                   |
| updates/deploy       | `logic/update-manager.ts`, `controller-deploy.ts`                        |
| build dispatcher     | `desktop/project.mjs`; `desktop/automation/*.mjs`                        |
| package              | `desktop/electron-builder.yml`; `desktop/resources/`                     |

`preload.ts` exposes request channels for runtime metadata, external/open/reveal
paths, updates, directory/project CRUD, session/UI preferences, pairing,
terminal status/open/write/resize/close, quick-panel operations, and controller
deploy. Renderer events are `desktop:pty-data`, `desktop:pty-exit`, and
`desktop:controller-deploy-log`. `main.ts` `registerIpcHandlers` is the
authoritative complete handler list.

## Controller inventory

`controller/src/http/app.ts` composes these vertical route groups:

- `modules/system`: status, GPU/system metrics, logs, events, and usage;
- `modules/compute`: engine abstraction, devices, instances, launch/evict;
- `modules/engines`: runtime discovery/install and model downloads;
- `modules/models`: recipes and model registry;
- `modules/studio`: settings, providers, rigs, and catalog;
- `modules/proxy`: OpenAI/Anthropic passthrough and token counting.

The frontend consumes this surface through `frontend/src/lib/api/*` and the
catch-all `/api/proxy`. The agent runtime directly proves only model discovery
and inference: `pi-runtime-models.ts` fetches `/v1/models` and configures
`${controller.url}/v1` providers. No source here proves gateway calls to
`/health`, `/status`, `/gpus`, or `/v1/metrics/vllm`.

## Other repository surfaces

- Tests live in `controller/test`, `services/agent-runtime/test`, and frontend
  test files; Bun and frontend quality scripts run them where configured.
- CI/release/maintenance workflows live under `.github/workflows`; CI validates
  contracts/layout, controller, runtime, frontend, desktop packaging, secrets,
  dependencies, and CodeQL.
- `.env.example` and `frontend/.env.example` document primary configuration.
- `release.config.cjs` drives semantic-release; `frontend/desktop/automation/release.mjs`
  prepares signed/updater artifacts.
- `scripts/install-controller.sh` and `frontend/desktop/logic/controller-deploy.ts`
  support remote controller installation.
- The only KittyLitter code in this checkout is the external CLI adapter,
  pairing route/IPC, and QR UI. Mobile and CLI source are not present.
