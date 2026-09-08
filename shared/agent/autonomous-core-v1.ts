import { Schema } from "effect";

export const AutonomousCoreVersionV1Schema = Schema.Literal(1);

const IdSchema = Schema.String.check(Schema.isUUID(), Schema.isPattern(/^[0-9a-f-]+$/));
const TextSchema = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(4096));
const CounterSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
);
const PositiveCounterSchema = CounterSchema.check(Schema.isGreaterThan(0));
const TimestampSchema = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
  Schema.makeFilter(
    (value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
  ),
);
const HttpEndpointSchema = Schema.String.check(
  Schema.makeFilter((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  }),
);

export const CoreIdentityV1Schema = Schema.Struct({
  coreId: IdSchema,
  hostId: IdSchema,
  runtimeId: IdSchema,
  controllerId: IdSchema,
});

export type CoreIdentityV1 = typeof CoreIdentityV1Schema.Type;

const EnvelopeFields = {
  version: AutonomousCoreVersionV1Schema,
  core: CoreIdentityV1Schema,
};

const SupportedVersionsSchema = Schema.Array(PositiveCounterSchema).check(
  Schema.isMinLength(1),
  Schema.makeFilter((versions) => new Set(versions).size === versions.length),
);

export const CoreProtocolAdvertisementSchema = Schema.Struct({
  core: CoreIdentityV1Schema,
  supportedVersions: SupportedVersionsSchema,
});

export const WorkspaceV1Schema = Schema.Struct({
  ...EnvelopeFields,
  workspaceId: IdSchema,
  revision: CounterSchema,
  label: TextSchema,
  rootPath: Schema.String.check(Schema.isPattern(/^\/[^\0]*$/), Schema.isMaxLength(4096)),
});

const ServiceReadinessSchema = Schema.Struct({
  instanceId: Schema.NullOr(IdSchema),
  state: Schema.Literals(["starting", "ready", "degraded", "draining", "blocked"]),
  reasons: Schema.Array(TextSchema),
}).check(
  Schema.makeFilter(
    (value) => value.instanceId !== null || value.state === "starting" || value.state === "blocked",
  ),
);

export const CoreReadinessV1Schema = Schema.Struct({
  ...EnvelopeFields,
  observedAt: TimestampSchema,
  runtime: ServiceReadinessSchema,
  controller: ServiceReadinessSchema,
  acceptsCommands: Schema.Boolean,
}).check(
  Schema.makeFilter(
    (value) =>
      !value.acceptsCommands ||
      (value.runtime.state === "ready" && value.controller.state === "ready"),
  ),
);

export const ControllerResolutionV1Schema = Schema.Struct({
  ...EnvelopeFields,
  configRevision: CounterSchema,
  source: Schema.Literal("service-settings"),
  serverEndpoint: HttpEndpointSchema,
  credentialState: Schema.Literals(["available", "locked", "missing"]),
  state: Schema.Literals(["unresolved", "verified", "unreachable", "identity-mismatch"]),
});

const CapabilityNameSchema = Schema.Literals([
  "jobs.background",
  "schedules",
  "approvals",
  "activity.replay",
  "workspace.files",
  "workspace.git",
  "terminal.reattach",
  "connectors",
  "plugins",
  "skills",
  "oauth.device",
  "oauth.loopback",
  "browser.headless",
  "browser.host",
  "desktop.native",
  "mobile.gateway",
]);

export const CoreCapabilityV1Schema = Schema.Struct({
  name: CapabilityNameSchema,
  state: Schema.Literals(["available", "unavailable", "requires-setup", "unsupported"]),
  executionHost: Schema.Literals(["core", "client"]),
  autonomous: Schema.Boolean,
  reason: Schema.NullOr(TextSchema),
}).check(
  Schema.makeFilter(
    (value) =>
      (!value.autonomous || value.executionHost === "core") &&
      (value.state === "available" || value.reason !== null),
  ),
);

export const CoreDiscoveryV1Schema = Schema.Struct({
  ...EnvelopeFields,
  contractStatus: Schema.Literal("proposed"),
  supportedVersions: SupportedVersionsSchema.check(
    Schema.makeFilter((versions) => versions.includes(1)),
  ),
  capabilities: Schema.Array(CoreCapabilityV1Schema),
  retention: Schema.Struct({
    eventsSeconds: PositiveCounterSchema,
    eventsMaxBytes: PositiveCounterSchema,
    commandReceiptsSeconds: PositiveCounterSchema,
    terminalBufferBytes: CounterSchema,
    terminalIdleSeconds: PositiveCounterSchema,
  }),
}).check(
  Schema.makeFilter(
    (value) =>
      new Set(value.capabilities.map((capability) => capability.name)).size ===
      value.capabilities.length,
  ),
);

export const CoreConnectionV1Schema = Schema.Struct({
  version: AutonomousCoreVersionV1Schema,
  profileId: IdSchema,
  expectedCore: CoreIdentityV1Schema,
  runtimeEndpoint: HttpEndpointSchema,
  controllerEndpoint: HttpEndpointSchema,
  state: Schema.Literals([
    "detached",
    "connecting",
    "authenticating",
    "checking-identity",
    "attached",
    "reconnecting",
    "blocked",
  ]),
  reason: Schema.NullOr(
    Schema.Literals([
      "transport-unavailable",
      "unauthenticated",
      "forbidden",
      "identity-mismatch",
      "version-mismatch",
      "not-ready",
    ]),
  ),
}).check(
  Schema.makeFilter(
    (value) =>
      (value.state !== "attached" || value.reason === null) &&
      (value.state !== "blocked" || value.reason !== null),
  ),
);

const ResourceFields = {
  id: IdSchema,
  workspaceId: IdSchema,
  revision: PositiveCounterSchema,
  updatedAt: TimestampSchema,
};
const JobStateSchema = Schema.Literals([
  "queued",
  "running",
  "waiting-approval",
  "cancel-requested",
  "succeeded",
  "failed",
  "cancelled",
  "interrupted",
]);
const JobSchema = Schema.Struct({
  ...ResourceFields,
  kind: Schema.Literal("job"),
  sessionId: IdSchema,
  commandId: IdSchema,
  state: JobStateSchema,
  summary: TextSchema,
});
const SessionSchema = Schema.Struct({
  ...ResourceFields,
  kind: Schema.Literal("session"),
  state: Schema.Literals(["idle", "busy", "archived", "interrupted"]),
});
const ScheduleSpecSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("interval"),
    seconds: PositiveCounterSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal("once"),
    at: TimestampSchema,
  }),
]);
const ScheduleSchema = Schema.Struct({
  ...ResourceFields,
  kind: Schema.Literal("schedule"),
  sessionId: IdSchema,
  schedule: ScheduleSpecSchema,
  state: Schema.Literals(["active", "paused", "completed"]),
  nextRunAt: Schema.NullOr(TimestampSchema),
});
const TerminalSchema = Schema.Struct({
  ...ResourceFields,
  kind: Schema.Literal("terminal"),
  state: Schema.Literals(["running", "exited", "expired", "lost"]),
  writerLeaseId: Schema.NullOr(IdSchema),
  writerLeaseExpiresAt: Schema.NullOr(TimestampSchema),
}).check(
  Schema.makeFilter(
    (value) =>
      (value.writerLeaseId === null) === (value.writerLeaseExpiresAt === null) &&
      (value.state === "running" || value.writerLeaseId === null),
  ),
);
const ApprovalSchema = Schema.Struct({
  ...ResourceFields,
  kind: Schema.Literal("approval"),
  jobId: IdSchema,
  state: Schema.Literals(["pending", "approved", "denied", "expired", "invalidated"]),
  actionDigest: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  expiresAt: TimestampSchema,
});
const ActivityResourceSchema = Schema.Union([
  JobSchema,
  SessionSchema,
  ScheduleSchema,
  TerminalSchema,
  ApprovalSchema,
]);

const CommandTargetFields = {
  workspaceId: IdSchema,
  expectedRevision: CounterSchema,
};
const JobInputFields = {
  sessionId: IdSchema,
  modelId: TextSchema,
  prompt: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(131072)),
};
const CommandBodySchema = Schema.Union([
  Schema.Struct({
    ...CommandTargetFields,
    ...JobInputFields,
    kind: Schema.Literal("job.submit"),
  }),
  Schema.Struct({
    ...CommandTargetFields,
    kind: Schema.Literal("job.cancel"),
    jobId: IdSchema,
  }),
  Schema.Struct({
    ...CommandTargetFields,
    ...JobInputFields,
    kind: Schema.Literal("schedule.put"),
    scheduleId: IdSchema,
    schedule: ScheduleSpecSchema,
    state: Schema.Literals(["active", "paused"]),
  }),
  Schema.Struct({
    ...CommandTargetFields,
    kind: Schema.Literal("schedule.delete"),
    scheduleId: IdSchema,
  }),
  Schema.Struct({
    ...CommandTargetFields,
    kind: Schema.Literal("approval.resolve"),
    approvalId: IdSchema,
    actionDigest: ApprovalSchema.fields.actionDigest,
    decision: Schema.Literals(["approve", "deny"]),
  }),
  Schema.Struct({
    ...CommandTargetFields,
    kind: Schema.Literal("terminal.open"),
    terminalId: IdSchema,
  }),
  Schema.Struct({
    ...CommandTargetFields,
    kind: Schema.Literal("terminal.close"),
    terminalId: IdSchema,
  }),
  Schema.Struct({
    ...CommandTargetFields,
    kind: Schema.Literal("terminal.claim"),
    terminalId: IdSchema,
  }),
  Schema.Struct({
    ...CommandTargetFields,
    kind: Schema.Literal("terminal.input"),
    terminalId: IdSchema,
    writerLeaseId: IdSchema,
    input: TextSchema,
  }),
]);

export const CoreCommandV1Schema = Schema.Struct({
  ...EnvelopeFields,
  commandId: IdSchema,
  issuedAt: TimestampSchema,
  expiresAt: TimestampSchema,
  body: CommandBodySchema,
}).check(Schema.makeFilter((value) => value.issuedAt < value.expiresAt));

export type CoreCommandV1 = typeof CoreCommandV1Schema.Type;

export const CoreCommandReceiptV1Schema = Schema.Struct({
  ...EnvelopeFields,
  commandId: IdSchema,
  resourceKind: Schema.Literals(["job", "schedule", "approval", "terminal"]),
  resourceId: IdSchema,
  resourceRevision: PositiveCounterSchema,
  committedAt: TimestampSchema,
  deduplicated: Schema.Boolean,
});

export const CoreErrorV1Schema = Schema.Struct({
  ...EnvelopeFields,
  code: Schema.Literals([
    "invalid-payload",
    "identity-mismatch",
    "version-mismatch",
    "unauthenticated",
    "forbidden",
    "not-found",
    "not-ready",
    "unsupported-capability",
    "revision-conflict",
    "idempotency-conflict",
    "command-expired",
    "approval-expired",
    "writer-lease-conflict",
    "cursor-expired",
  ]),
  message: TextSchema,
});

const CursorSchema = Schema.Struct({
  epoch: IdSchema,
  sequence: CounterSchema,
});

export const ActivityReplayRequestV1Schema = Schema.Struct({
  ...EnvelopeFields,
  workspaceId: IdSchema,
  cursor: CursorSchema,
});

export const ActivitySnapshotV1Schema = Schema.Struct({
  ...EnvelopeFields,
  workspaceId: IdSchema,
  capturedAt: TimestampSchema,
  cursor: CursorSchema,
  resources: Schema.Array(ActivityResourceSchema),
}).check(
  Schema.makeFilter(
    (value) =>
      value.resources.every((resource) => resource.workspaceId === value.workspaceId) &&
      new Set(value.resources.map((resource) => `${resource.kind}:${resource.id}`)).size ===
        value.resources.length,
  ),
);

export const ActivityEventV1Schema = Schema.Struct({
  ...EnvelopeFields,
  workspaceId: IdSchema,
  occurredAt: TimestampSchema,
  cursor: Schema.Struct({
    epoch: IdSchema,
    sequence: PositiveCounterSchema,
  }),
  change: Schema.Union([
    Schema.Struct({
      kind: Schema.Literal("upsert"),
      resource: ActivityResourceSchema,
    }),
    Schema.Struct({
      kind: Schema.Literal("remove"),
      resourceKind: Schema.Literals(["job", "session", "schedule", "terminal", "approval"]),
      resourceId: IdSchema,
      revision: PositiveCounterSchema,
    }),
  ]),
}).check(
  Schema.makeFilter(
    (value) =>
      value.change.kind !== "upsert" || value.change.resource.workspaceId === value.workspaceId,
  ),
);

export type ActivitySnapshotV1 = typeof ActivitySnapshotV1Schema.Type;
export type ActivityEventV1 = typeof ActivityEventV1Schema.Type;

export function coreBoundaryV1(expected: CoreIdentityV1) {
  const matches = Schema.makeFilter(
    (value: { readonly core: CoreIdentityV1 }) =>
      value.core.coreId === expected.coreId &&
      value.core.hostId === expected.hostId &&
      value.core.runtimeId === expected.runtimeId &&
      value.core.controllerId === expected.controllerId,
  );
  const options = { onExcessProperty: "error" } as const;
  return {
    advertisement: Schema.decodeUnknownEffect(
      CoreProtocolAdvertisementSchema.check(matches),
      options,
    ),
    discovery: Schema.decodeUnknownEffect(CoreDiscoveryV1Schema.check(matches), options),
    readiness: Schema.decodeUnknownEffect(CoreReadinessV1Schema.check(matches), options),
    controllerResolution: Schema.decodeUnknownEffect(
      ControllerResolutionV1Schema.check(matches),
      options,
    ),
    workspace: Schema.decodeUnknownEffect(WorkspaceV1Schema.check(matches), options),
    command: Schema.decodeUnknownEffect(CoreCommandV1Schema.check(matches), options),
    receipt: Schema.decodeUnknownEffect(CoreCommandReceiptV1Schema.check(matches), options),
    error: Schema.decodeUnknownEffect(CoreErrorV1Schema.check(matches), options),
    snapshot: Schema.decodeUnknownEffect(ActivitySnapshotV1Schema.check(matches), options),
    event: Schema.decodeUnknownEffect(ActivityEventV1Schema.check(matches), options),
    replay: Schema.decodeUnknownEffect(ActivityReplayRequestV1Schema.check(matches), options),
  };
}
