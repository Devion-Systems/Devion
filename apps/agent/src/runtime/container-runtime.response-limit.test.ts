import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContainerRuntime } from "./container-runtime.js";

test("rejects an oversized Docker log response before retaining it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "devion-agent-test-"));
  const socketPath = join(directory, "docker.sock");
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/octet-stream" });
    response.end(Buffer.alloc(1_024 * 1_024 + 1, "x"));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });

  try {
    const runtime = new ContainerRuntime(socketPath);
    await expect(runtime.logs("01234567-89ab-cdef-0123-456789abcdef", 1)).rejects.toThrow(
      "Docker API response exceeded",
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
