import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TraefikManager } from "./traefik.js";

test("writes a single service with every eligible workload backend", async () => {
  const directory = await mkdtemp(join(tmpdir(), "devion-traefik-"));
  try {
    const manager = new TraefikManager({ dynamicConfigDir: directory });
    await manager.syncProjectRoutes(
      { projectId: "project-1" },
      [{
        id: "domain-1",
        hostname: "app.example.test",
        upstreams: [{ url: "http://10.20.0.16:32802" }, { url: "http://10.20.0.15:32781" }],
      }],
    );
    const config = JSON.parse(await readFile(join(directory, "project-project-1.json"), "utf8"));
    const service = config.http.services["domain-project-1-domain-1"];
    expect(service.loadBalancer.servers).toEqual([
      { url: "http://10.20.0.15:32781" },
      { url: "http://10.20.0.16:32802" },
    ]);
    expect(config.http.routers["https-project-1-domain-1"].service).toBe("domain-project-1-domain-1");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("preserves an explicitly reported standard workload port", async () => {
  const directory = await mkdtemp(join(tmpdir(), "devion-traefik-"));
  try {
    const manager = new TraefikManager({ dynamicConfigDir: directory });
    await manager.syncProjectRoutes(
      { projectId: "project-1" },
      [{ id: "domain-1", hostname: "app.example.test", upstreams: [{ url: "http://10.20.0.15:80" }] }],
    );
    const config = JSON.parse(await readFile(join(directory, "project-project-1.json"), "utf8"));
    expect(config.http.services["domain-project-1-domain-1"].loadBalancer.servers).toEqual([{ url: "http://10.20.0.15" }]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("writes no router or fallback service when no upstream is available", async () => {
  const directory = await mkdtemp(join(tmpdir(), "devion-traefik-"));
  try {
    const manager = new TraefikManager({ dynamicConfigDir: directory });
    await manager.syncProjectRoutes(
      { projectId: "project-1" },
      [{ id: "domain-1", hostname: "app.example.test", upstreams: [] }],
    );
    const config = JSON.parse(await readFile(join(directory, "project-project-1.json"), "utf8"));
    expect(config.http.routers).toEqual({});
    expect(config.http.services).toEqual({});
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects arbitrary upstream URL features even if a caller bypasses the domain resolver", async () => {
  const directory = await mkdtemp(join(tmpdir(), "devion-traefik-"));
  try {
    const manager = new TraefikManager({ dynamicConfigDir: directory });
    await expect(manager.syncProjectRoutes(
      { projectId: "project-1" },
      [{ id: "domain-1", hostname: "app.example.test", upstreams: [{ url: "http://127.0.0.1:8080/admin" }] }],
    )).rejects.toThrow("bare internal service URL");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects a metadata endpoint even when it is a bare URL", async () => {
  const directory = await mkdtemp(join(tmpdir(), "devion-traefik-"));
  try {
    const manager = new TraefikManager({ dynamicConfigDir: directory });
    await expect(manager.syncProjectRoutes(
      { projectId: "project-1" },
      [{ id: "domain-1", hostname: "app.example.test", upstreams: [{ url: "http://169.254.169.254:8080" }] }],
    )).rejects.toThrow("link-local");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
