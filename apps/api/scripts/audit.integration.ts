// Destructive fixture setup is restricted to the dedicated local test database.
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
process.env.DATABASE_URL = "postgres://devion_test:devion_test_local_only@127.0.0.1:55432/devion_test";
process.env.BETTER_AUTH_SECRET = crypto.randomUUID() + crypto.randomUUID();
process.env.BETTER_AUTH_URL = "http://localhost:3999";
process.env.NODE_ENV = "test";
const { db, getDbPool, closeDbPool, organization, user, projects, team, teamMember, projectTeams, applications, deployments, workloads, nodes } = await import("@repo/db");
const { migrate } = await import("drizzle-orm/node-postgres/migrator");
const { listProjectPage, projectListQuery } = await import("../src/features/projects/list-page.js");
const { eq } = await import("drizzle-orm");
const id = crypto.randomUUID();
const orgA = `${id}-a`, orgB = `${id}-b`, actor = `${id}-user`, teamId = `${id}-team`;
try {
  await migrate(db, { migrationsFolder: new URL("../../../packages/db/drizzle", import.meta.url).pathname });
  await db.insert(user).values({ id: actor, name: "Audit", email: `${id}@example.test` });
  await db.insert(organization).values([
    { id: orgA, name: "A", slug: orgA, createdAt: new Date() },
    { id: orgB, name: "B", slug: orgB, createdAt: new Date() },
  ]);
  await db.insert(team).values({ id: teamId, name: "Audit team", organizationId: orgA, createdAt: new Date() });
  await db.insert(teamMember).values({ id: `${id}-membership`, teamId, userId: actor, createdAt: new Date() });
  const rows = Array.from({ length: 1000 }, (_, i) => ({
    id: `${id}-${String(i).padStart(4, "0")}`, organizationId: orgA, createdByUserId: actor,
    name: `Project ${i}`, slug: `p-${i}`, sourceType: "blank" as const,
    accessMode: i % 2 ? "team" as const : "organization" as const,
  }));
  await db.insert(projects).values(rows);
  await db.insert(projects).values({ ...rows[0]!, id: `${id}-foreign`, slug: "foreign", organizationId: orgB });
  await db.insert(projectTeams).values({ projectId: rows[1]!.id, teamId });
  const query = projectListQuery.parse({ limit: 25 });
  const page = await listProjectPage(orgA, actor, "member", query);
  assert.equal(page.items.length, 25);
  assert.equal(page.total, 501);
  assert(page.items.every(p => p.organizationId === orgA));
  const teamPage = await listProjectPage(orgA, actor, "member", { ...query, teamId });
  assert.equal(teamPage.total, 1);
  assert.equal(teamPage.items[0]?.id, rows[1]!.id);
  const injected = await listProjectPage(orgA, actor, "member", { ...query, search: "%' OR 1=1 --" });
  assert.equal(injected.total, 0);
  await db.delete(teamMember).where(eq(teamMember.userId, actor));
  assert.equal((await listProjectPage(orgA, actor, "member", query)).total, 500);
  assert.equal((await listProjectPage(orgA, actor, "admin", query)).total, 1000);
  const second = await listProjectPage(orgA, actor, "member", { ...query, page: 2 });
  assert(!second.items.some(p => page.items.some(first => first.id === p.id)));
  assert.equal(projectListQuery.safeParse({ limit: "Infinity" }).success, false);
  const nodeRows = Array.from({ length: 100 }, () => ({ id: crypto.randomUUID(), token: crypto.randomUUID() + crypto.randomUUID() }));
  const resources = { cpuMilli: { capacity: 10000, allocatable: 10000, reserved: 0, usage: 0 }, memoryMib: { capacity: 10000, allocatable: 10000, reserved: 0, usage: 0 }, storageMib: { capacity: 10000, allocatable: 10000, reserved: 0, usage: 0 } };
  await db.insert(nodes).values(nodeRows.map(node => ({ id: node.id, organizationId: orgA, name: "Audit node", hostname: "test", architecture: "arm64", os: "linux", agentVersion: "test", status: "ready" as const, resources, agentTokenHash: createHash("sha256").update(node.token).digest("hex") })));
  const appId = crypto.randomUUID(), deploymentId = crypto.randomUUID();
  await db.insert(applications).values({ id: appId, projectId: rows[0]!.id, organizationId: orgA, name: "Audit", slug: "audit", sourceType: "docker" });
  await db.insert(deployments).values({ id: deploymentId, applicationId: appId, version: 1, image: "audit:fixture", replicas: 1000, desiredState: "running", runtime: "container", requirements: { cpuMilli: 1, memoryMib: 1, storageMib: 0, runtime: "container" } });
  const workloadRows = nodeRows.flatMap(node => Array.from({ length: 10 }, () => ({ id: crypto.randomUUID(), nodeId: node.id, deploymentId, desiredState: "running" as const })));
  await db.insert(workloads).values(workloadRows);
  const { nodeRoutes } = await import("../src/routes/nodes.routes.js");
  const agentTimes: number[] = [];
  const sample = (workloadId: string) => ({ workloadId, recordedAt: new Date().toISOString(), cpuUsagePercent: 1, memoryUsageBytes: 1024, memoryLimitBytes: 2048, networkRxBytes: 0, networkTxBytes: 0, diskReadBytes: 0, diskWriteBytes: 0 });
  const request = (token: string, path: string, body: unknown) => nodeRoutes.request(path, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  await Promise.all(nodeRows.map(async node => {
    const start = performance.now();
    assert.equal((await request(node.token, "/api/agents/heartbeat", { status: "ready", resources })).status, 200);
    assert.equal((await request(node.token, "/api/agents/workloads/metrics", { samples: workloadRows.filter(w => w.nodeId === node.id).map(w => sample(w.id)) })).status, 202);
    agentTimes.push(performance.now()-start);
  }));
  agentTimes.sort((a,b) => a-b);
  assert.equal((await request(nodeRows[0]!.token, "/api/agents/workloads/metrics", { samples: [sample(workloadRows[10]!.id)] })).status, 403);
  assert.equal((await request("invalid", "/api/agents/heartbeat", { status: "ready", resources })).status, 401);
  assert.equal((await request(nodeRows[0]!.token, "/api/agents/workloads/metrics", { samples: Array(501).fill(sample(workloadRows[0]!.id)) })).status, 400);
  console.log(JSON.stringify({ scenario: "100 authenticated agent heartbeat + 10-sample metrics requests in parallel / 1000 workloads; in-process Hono + real PostgreSQL, no ingress middleware", p50Ms: agentTimes[49], p95Ms: agentTimes[94], p99Ms: agentTimes[98], assertions: "cross-node metrics denied; invalid token denied; oversized batch denied" }));
  const comparisons = [];
  // The old owner/admin list path fetched all project rows, then sorted/sliced
  // in memory. Compare that data-loading stage with the new page + count query.
  const oldList = async () => {
    const all = await db.select().from(projects).where(eq(projects.organizationId, orgA));
    return { items: all.sort((a,b) => b.updatedAt.getTime()-a.updatedAt.getTime() || a.id.localeCompare(b.id)).slice(0,25), total: all.length };
  };
  const newList = () => listProjectPage(orgA, actor, "admin", query);
  assert.deepEqual((await oldList()).items.map(p => p.id), (await newList()).items.map(p => p.id));
  for (let trial = 0; trial < 3; trial++) {
    const timings: Record<string, number[]> = {};
    for (const [name, run] of trial % 2 ? [["after", newList], ["before", oldList]] as const : [["before", oldList], ["after", newList]] as const) {
      const values: number[] = [];
      await run();
      await Promise.all(Array.from({ length: 100 }, async () => {
        const start = performance.now(); await run(); values.push(performance.now()-start);
      }));
      timings[name] = values.sort((a,b) => a-b);
    }
    comparisons.push({ trial, beforeP95Ms: timings.before![94], afterP95Ms: timings.after![94], beforeRowsPerCall: 1000, afterRowsPerCall: 26 });
  }
  const durations: number[] = [];
  await Promise.all(Array.from({ length: 100 }, async () => {
    const start = performance.now();
    await listProjectPage(orgA, actor, "member", query);
    durations.push(performance.now() - start);
  }));
  durations.sort((a,b) => a-b);
  const plan = await getDbPool().query("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id FROM projects WHERE organization_id = $1 ORDER BY updated_at DESC, id LIMIT 25", [orgA]);
  console.log(JSON.stringify({ scenario: "100 concurrent project-page queries / 1000 projects; not HTTP latency", comparisons, p50: durations[49], p95: durations[94], p99: durations[98], plan: plan.rows, assertions: "tenant isolation, team removal, injection, stable pagination passed" }, null, 2));
} finally {
  await db.delete(projects).where(eq(projects.organizationId, orgA));
  await db.delete(projects).where(eq(projects.organizationId, orgB));
  await db.delete(organization).where(eq(organization.id, orgA));
  await db.delete(organization).where(eq(organization.id, orgB));
  await db.delete(user).where(eq(user.id, actor));
  await closeDbPool();
}
