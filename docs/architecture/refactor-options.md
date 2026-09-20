# Refactor options and proposed scope

## Option A — one remote runtime, thin desktop

Run controller and agent runtime on an always-on host. Desktop is an
authenticated HTTP client; local-only mode starts the same service locally.

**Demands:** a versioned runtime contract; service/client identity and
authorization; configurable private bind; TLS ingress; headless secrets and
OAuth; server-owned settings/projects/files/tools/pairing; migration from
Electron user data.

**Migration:** secure the loopback service first, add a remote deployment
profile, move each remaining in-process/IPC API behind HTTP, migrate state,
then switch clients. Keep local launch as a profile.

**Trade-offs:** cleanest ownership and easiest mental model, but remote project
paths, shell, browser, Obsidian, and connector executables are not the Mac's.
Operational cost is a long-lived service, ingress, backups, upgrades, and
observability. Direct public exposure of the raw runtime is unacceptable.

## Option B — remote mobile plane plus local desktop runtime

Keep the desktop runtime for Mac-local work and introduce a distinct,
always-on mobile runtime/gateway. Sessions and projects either remain separate
or synchronize through a defined controller service.

**Demands:** explicit runtime identity, session ownership/synchronization,
connector and credential placement, conflict handling, and mobile routing.

**Migration:** build the mobile plane without disturbing local desktop;
gradually expose shared controller/session concepts.

**Trade-offs:** preserves local filesystem/browser behavior and limits desktop
regression, but creates two state owners and two user experiences. It has the
highest lasting product complexity and still needs secure public ingress.

## Option C — private runtime behind controller gateway or relay

Deploy the runtime on the always-on host but leave it private. A
controller-owned gateway, reverse proxy, VPN/tunnel, or relay terminates TLS,
authenticates devices, rate-limits/audits traffic, and forwards only an
intentional contract.

**Demands:** gateway/mobile protocol, identity translation, trusted private
runtime channel, ingress operations, plus the same state/OAuth cleanup as A.

**Migration:** define protocol and trust boundary; deploy gateway and runtime
side by side; pair devices to gateway; point desktop at that entry; retain
direct loopback in local mode.

**Trade-offs:** best containment for shell/files/browser capabilities and best
place for device revocation and TLS. It adds one operational component and
cannot solve “Mac off” unless both gateway and runtime are on the always-on
host.

## Recommendation

Use **Option C's network topology with Option A's single runtime/state owner**:
controller and agent runtime live on an always-on host, raw runtime remains
private, and an authenticated gateway/front door exposes a versioned subset to
desktop and mobile. Local-only mode launches the same runtime on loopback and
may use a local front door.

This meets the availability goal without publishing unauthenticated
filesystem, terminal, browser, or connector APIs. It also avoids Option B's
permanent synchronization problem.

What would change the recommendation:

- If desktop-local files and browser control must remain identical in every
  remote session, choose B or design a separately authenticated desktop worker.
- If the external KittyLitter protocol mandates a hosted relay with its own
  state owner, adapt the topology to that authoritative contract.
- If deployment is guaranteed to a private, identity-aware VPN and there is no
  public ingress, a separate gateway process may be unnecessary, but runtime
  authorization is still required.

## Phased workstreams

| Phase                                | Size / depends on | Deliverable and main risk                                                                                                                                               |
| ------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Protocol and ownership discovery  | S–unknown         | Obtain gateway/CLI/mobile source or spec; map endpoints, token lifecycle, relay and session owner. **Hard dependency**; risk is external incompatibility.               |
| 2. Threat model and service contract | M / 1             | Versioned Effect Schema contract, identities/scopes, TLS/ingress, rate/audit/revocation decisions. Risk: exposing host-user capabilities.                               |
| 3. Headless runtime foundation       | M / 2             | Configurable bind/data/resources/workspaces, private authenticated transport, readiness/graceful service/container/systemd packaging. Keep Electron local mode.         |
| 4. State owner and migration         | L / 2–3           | Runtime settings API; projects/sessions/connectors/goals/automations ownership; headless secret store; idempotent import/rollback. Risk: credentials and path mismatch. |
| 5. Close frontend/desktop bypasses   | L / 3–4           | Proxy settings/local-agents/controller resolution; remove direct store imports and implicit project IPC precedence; align filesystem/git/PTY host.                      |
| 6. OAuth and local capabilities      | L / 2–5           | Public/mediated callback or PKCE; define Chrome/CUA/Obsidian/file reveal/`gh` behavior. Risk: wrong-host callbacks and over-privilege.                                  |
| 7. Gateway and remote pairing        | M–L / 1–4         | Authenticated pairing API, short-lived bootstrap token, device keys, revoke/rotate, trusted public/relay URL; remove mandatory local CLI.                               |
| 8. Compatibility and operations      | M / all           | Remote phone survives desktop shutdown; desktop remote matrix; local-only parity; backup, upgrade, reconnect, outage and rollback acceptance.                           |

### Minimum slice for issue #3 acceptance

Phases 1–4, the secure front door from phases 2–3, phase 7, and enough of phase
5 for desktop settings/connectors/projects/sessions/models/turns are mandatory.
Claiming full desktop function also requires phase 6 decisions and validation
for host-local files, terminal, browser, and OAuth. A relay alone is not a
minimum slice if the agent runtime still dies with Electron.

## Security and operational implications

- Never make the current runtime bind public by only removing its Host guard.
- Give controller, desktop, runtime, and devices separate rotatable identities.
- Pair with single-use, short-lived bootstrap material and provide lost-device
  revocation.
- Encrypt secrets with a headless-host key source and back up only recoverable
  ciphertext/metadata.
- Define upgrade compatibility between desktop, mobile, gateway, runtime, and
  controller contract versions.
- Instrument health, auth failures, device actions, and migration without
  logging prompts, tokens, or credentials.

## Decisions required from the repository owner

1. Source/owner of the gateway, CLI, and mobile protocol.
2. Single-user only versus future multi-user isolation.
3. Whether the runtime may be internet-facing or only behind gateway/VPN.
4. Hosting target: Linux systemd, container, macOS daemon, or managed service.
5. TLS/tunnel/relay and service/device identity mechanism.
6. Whether controller, runtime, and pairing credentials must be distinct
   (recommended: yes).
7. Pairing lifetime, device count, scope, rotation, revocation, and recovery.
8. Whether desktop-local filesystem/browser/PTY behavior remains first-class
   in remote mode.
9. Whether local-only mode remains a permanently supported first-class mode.
10. Headless secret store and OAuth callback strategy.
11. Data-dir migration direction, rollback duration, and backup expectations.
12. Multiple controller/runtime representation and session ownership.
