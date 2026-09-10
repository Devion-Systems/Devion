# Devion performance and security audit — 2026-09-10

## Scope and evidence

Static review covered the Bun/Hono API, Drizzle/PostgreSQL access, Better Auth,
organization/project policy, controllers, agent/Docker adapter, Builder, metrics,
Traefik helpers, and the existing unit tests. No production database, Docker
daemon, or deployed API was available. Therefore no latency percentiles,
throughput figures, or before/after timings are claimed in this report.

## Current security risks

| Priority | Finding | Evidence and impact | Status |
| --- | --- | --- | --- |
| P1 | Builder process output was retained without a byte limit. | `runProcess` accumulated stdout/stderr and forwarded every line. A repository build can emit unlimited output, consuming Builder memory and creating unlimited log writes. | Fixed: 1 MiB aggregate cap and regression test. |
| P1 | Docker raw responses were retained without a byte limit. | Agent log, exec and Docker API response helpers accumulated every chunk. A noisy container's logs could exhaust agent memory before reporting to the API. | Fixed: raw responses capped at 1 MiB; JSON at 2 MiB; image-pull progress discarded. |
| P1 | Builder API parsed arbitrarily large request bodies. | The Builder's `/v1/*` API had authentication but no body limit before `request.json()`. | Fixed: 1 MiB pre-parse limit and regression test. |
| P2 | Rate-limit client identity depends on proxy-provided headers. | `clientIp()` accepts `x-real-ip`, then `x-forwarded-for`; the API must only be reachable through a proxy that overwrites these headers. Direct exposure makes rate-limit keys spoofable. | Deployment/configuration action required. |
| P2 | Auth session cache has a five-minute TTL. | Better Auth uses `cookieCache` with `maxAge: 5 * 60`. This is acceptable only if its signed cache correctly reflects the project's required revocation semantics. | Verify with an integration test for revocation and role removal before production sign-off. |

No P0 path was established in the reviewed code. Dynamic SQL use in the reviewed
metrics and rate-limit paths uses placeholders; the audit-log `like()` values
are Drizzle parameters rather than SQL string interpolation.

## Current performance risks

| Priority | Risk | Evidence |
| --- | --- | --- |
| P1 | Project lists load all accessible projects into application memory before filter/sort/pagination. | `listAccessibleProjects()` uses `findMany`, then `projects.routes.ts` filters and slices. This will not scale with a large organization. |
| P1 | Agent telemetry writes scale per report. | The telemetry endpoint uses `Promise.all` for up to 500 reports, each with a workload update and optionally a port replacement transaction. |
| P2 | Agent command polling selects all eligible commands before leasing. | `/api/agents/commands` has no query limit; an exceptional backlog produces a large response and many concurrent updates. |
| P2 | Audit filtering with JSON text `LIKE` cannot use a normal project/application key index. | `projects.routes.ts` and `applications.routes.ts` search serialized metadata. |
| P2 | Metrics aggregation is SQL-bucketed, but baseline query latency has not been measured. | The provider uses a parameterized CTE and range predicate. Existing retention index migration is a positive control; run `EXPLAIN (ANALYZE, BUFFERS)` on representative workload counts before changing it. |

## Existing effective controls

- Core API has a 10 MiB body limit, request IDs, structured logging, restrictive
  CORS, CSRF-origin checks on browser mutations, and security headers.
- Better Auth is centrally configured with strong password minimums, session
  revocation on password reset, password breach checks, MFA, passkeys, trusted
  origins, and account/bootstrap controls.
- Organization and project lookups generally scope IDs through organization,
  project, or node ownership. Agent secret and credential routes derive the node
  from the bearer token and verify workload ownership.
- Agent metrics are batched (up to 500), Docker metrics are concurrency-limited,
  and controller leases prevent concurrent reconciliation of one deployment.
- Metrics retention deletes bounded batches; Builder already batches normal log
  writes and uses argument-array process spawning for Git and workflow commands.

## Implemented, bounded changes

| Metric/property | Before | After | Evidence |
| --- | --- | --- | --- |
| Builder captured process output | Unbounded | 1 MiB per process across stdout/stderr | `apps/builder/src/process.ts`, `process.test.ts` |
| Builder partial line buffer | Unbounded for output without newlines | 64 KiB maximum pending fragment | `apps/builder/src/process.ts` |
| Agent Docker raw response | Unbounded | 1 MiB | `container-runtime.ts`, response-limit test |
| Agent Docker JSON response | Unbounded | 2 MiB | `container-runtime.ts` |
| Docker image-pull progress retention | Retained | Discarded on successful pull | `container-runtime.ts` |
| Builder request body before parsing | Unbounded | 1 MiB | `app.ts`, API regression test |

These are resource-bound invariants, not latency benchmarks. The changes do not
remove authentication, tenant checks, validation, or isolation.

## Prioritized optimization plan

1. P1: Move project-list filtering, sorting, and pagination into a tenant-scoped
   SQL query. Add a query-count/`EXPLAIN` fixture before changing indexes.
2. P1: Batch agent telemetry updates and observed-port replacement per node
   transaction where correctness permits. Benchmark 100 and 500 reports.
3. P2: Add a bounded command-poll page and lease candidates in a set-based query.
4. P2: Replace audit metadata text search with an explicit, indexed project or
   application reference only after a migration/backfill decision.
5. P2: Instrument HTTP duration, DB query duration, controller duration,
   scheduler duration, agent ingest duration, and Builder queue wait with the
   existing OpenTelemetry module. Never attach tenant IDs, secrets, URLs, or SQL
   parameters as metric labels.
6. P2: Add a trusted-proxy deployment setting or make the API private behind
   Traefik so client-IP limits cannot be forged.
7. P3: Add integration tests for session revocation, role removal, cross-tenant
   object IDs, and browser-origin mutations.

## Measurement plan

Use an isolated PostgreSQL and Docker test node, with realistic cardinalities:

- 100 concurrent authenticated list requests; record p50/p95/p99, errors,
  database connection count, and queries/request.
- 100 and 1,000 synthetic workloads; record controller duration, writes/cycle,
  command count, and scheduler duration.
- 100 simultaneous agent heartbeats and metrics batches; record ingest p95,
  rows written, transaction time, and API memory.
- Large project/application/deployment lists; capture `EXPLAIN (ANALYZE,
  BUFFERS)` and payload size.

Run each scenario before and after one isolated change, three times, on the same
hardware. Persist raw results with the commit SHA. Do not run them against a
production control plane.

## Production decision

Security production ready: **NO**. The fixed resource-exhaustion paths need Bun
test execution, and the P1 project-list/telemetry scaling work plus P2
trusted-proxy and session-revocation verification remain.

Performance production ready: **NO measurable decision**. No representative
environment was available, so p50/p95/p99 and database plans have not been
measured.

Architecture decision: none is required for the implemented fixes. The proposed
project-list and telemetry improvements fit the existing modular TypeScript,
PostgreSQL, separate Builder, and standalone Node agent architecture.
