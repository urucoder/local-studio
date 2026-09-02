# State and data map

“Move” means ownership in the recommended remote-runtime design. It does not
authorize blindly copying credentials.

## Agent and desktop data

| Path                                | Shape / writer and reader                                                                                                 | Kind                            | Placement                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| `api-settings.json`                 | `{backendUrl, apiKey}`; runtime `settings-service.ts`; currently also imported by Next                                    | user config + secret            | **must move with runtime**; expose a masked API                                            |
| `pi-agent/`                         | Pi providers, auth/settings, extensions, prompt files; `pi-runtime-models.ts`, Pi SDK                                     | user config + runtime state     | **must move with runtime**                                                                 |
| Pi session directory                | native JSONL selected by `PI_CODING_AGENT_SESSION_DIR`, Pi settings, or defaults; `sessions-store.ts`                     | durable user content            | **must move with runtime**                                                                 |
| `session-metadata.json`             | per-session archive/title metadata; `session-metadata-store.ts`                                                           | durable user config             | **must move with runtime**                                                                 |
| `rollout-cache/`                    | memoized transcript usage summaries; `rollout-cache.ts`                                                                   | rebuildable cache               | **can be duplicated/rebuilt**                                                              |
| `projects.json`                     | project paths; runtime `projects-store.ts` and Electron `logic/projects-store.ts` currently share the injected file       | machine-local registry          | **must move with execution runtime**; desktop registry needs explicit separation/migration |
| `connectors.json`                   | connector definitions with masked/secret fields; `connectors-service.ts`                                                  | config + secrets                | **must move with runtime**                                                                 |
| `connector-grants.json`             | model/connector/tool allowlists; `connector-grants.ts`                                                                    | security policy                 | **must move with runtime**                                                                 |
| `oauth-tokens.json`                 | generic OAuth grants, atomic mode-0600 writes; `oauth-connectors.ts`                                                      | secret                          | **must move with runtime** using headless secret protection                                |
| `google-account.json`               | Google account/client metadata; `google-account.ts`                                                                       | account config                  | **must move with runtime**                                                                 |
| `oauth-vault.json`                  | Electron `safeStorage` ciphertext; desktop `logic/oauth-vault.ts`, requested by runtime `oauth-vault.ts` over process IPC | machine-bound secret            | **must stay desktop** in current form; migrate into a new runtime secret store             |
| `automations/*.json`                | schedules/prompts; `automations-store.ts` and scheduler                                                                   | durable runtime work            | **must move with runtime**                                                                 |
| `goals/*.json` and legacy goal file | thread goals/budgets; `goal-prompt.ts`, `goals-store.ts`                                                                  | durable runtime work            | **must move with runtime**                                                                 |
| browser engine preference           | JSON named by `browser-host/browser-engines.ts`                                                                           | user preference                 | **can be duplicated**                                                                      |
| prompt templates                    | `pi-agent/prompt-templates` and `pi-agent/prompts`; `prompt-templates-store.ts`                                           | user content                    | **must move with runtime**                                                                 |
| user plugins/skills                 | Pi directories plus packaged resources; `user-plugins.ts`, `skill-discovery.ts`                                           | user code/config                | **must move with runtime**; packaged defaults may be duplicated                            |
| `embedded-frontend.port`            | stable origin port; `desktop/logic/app-server.ts`                                                                         | desktop machine identity/cache  | **must stay desktop**                                                                      |
| `embedded-frontend.pid`             | stale child cleanup; `app-server.ts`                                                                                      | ephemeral desktop process state | **must stay desktop**                                                                      |
| session/UI preference files         | `main.ts` read/write helpers and `desktop-settings.ts`                                                                    | desktop UI config               | **must stay desktop**                                                                      |
| Electron update/settings files      | electron-updater and app identity                                                                                         | desktop config/cache            | **must stay desktop**                                                                      |

`services/agent-runtime/src/data-dir.ts` creates the runtime directory mode
0700, defaults to `~/.local-studio`, and performs a one-time migration of
legacy `api-settings.json`. Electron overrides that location with its own
`userData` directory (`agent-runtime-server.ts`), producing the current host
affinity.

## Controller data

The controller has an independent interpretation of
`LOCAL_STUDIO_DATA_DIR` (`controller/src/config/env.ts`). Its default is the
repository-level `data/`, not the runtime's `~/.local-studio`.

| Path                                      | Owner                                                                                                  | Classification                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `controller.db` or `LOCAL_STUDIO_DB_PATH` | SQLite stores for requests, metrics, downloads, settings, rigs and instances (`controller/src/stores`) | controller durable state; stays with controller       |
| persisted controller config/recipes       | `config/persisted-config.ts`, model/studio stores                                                      | controller durable state; stays with controller       |
| logs                                      | `core/log-files.ts`                                                                                    | controller operational state; stays with controller   |
| `runtime/venvs/*`                         | engine installation/launcher modules                                                                   | controller-host runtime assets; stays with controller |
| model directory                           | configured `LOCAL_STUDIO_MODELS_DIR`                                                                   | large durable controller-host data                    |

Sharing one physical directory between controller and agent runtime is not an
architectural requirement and risks accidental collisions. Remote deployment
should use explicit, separate roots.

## Claimed gateway files

`litter-bridge.json` and `litter-controller-id` do **not** exist in or get
referenced by this source tree. Their schema, writer, reader, permissions,
lifecycle, and migration class are unknown. The pairing schema visible here is
only the CLI output:

```text
{ v: integer, node_id: non-empty string, token: non-empty string,
  host_name?: non-empty string, relay?: string | null }
```

Evidence: `frontend/desktop/logic/kittylitter-pairing.ts`,
`normalizeKittylitterPairingJson`. `relay` is preserved, but this repository
does not establish whether the external binary produces or consumes it.

## Migration rules

1. Stop all writers before copying mutable stores.
2. Never copy Electron `safeStorage` ciphertext and assume it is decryptable on
   a headless host.
3. Resolve whether project paths denote desktop-host or runtime-host paths.
4. Import credentials through a one-time authenticated channel, then rotate
   pairing/runtime credentials.
5. Keep rollback snapshots and schema/version markers; this checkout has no
   general remote data-dir migration tool.
