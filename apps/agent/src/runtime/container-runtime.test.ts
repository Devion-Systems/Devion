import { expect, test } from "bun:test";
import { ContainerRuntime } from "./container-runtime.js";

type DockerCall = { method: string; path: string; body: unknown };

function mockedRuntime(calls: DockerCall[]): ContainerRuntime {
  const runtime = new ContainerRuntime("/unused/docker.sock");
  let inspections = 0;
  (runtime as unknown as { request: (method: string, path: string, body?: unknown) => Promise<unknown> }).request = async (method, path, body) => {
    calls.push({ method, path, body });
    if (path.includes("/containers/devion-workload-0123456789abcdef0123456789abcdef/json")) {
      inspections += 1;
      if (inspections === 1) throw new Error("Docker API 404: absent");
      return { NetworkSettings: { Ports: {} } };
    }
    return {};
  };
  return runtime;
}

test("provisions a labelled named volume and mounts it read-only", async () => {
  const calls: DockerCall[] = [];
  await mockedRuntime(calls).start({
    workloadId: "01234567-89ab-cdef-0123-456789abcdef",
    image: "example/image:latest",
    cpuMilli: 250,
    memoryMib: 256,
    volumes: [{ id: "46ac6dc2-6c87-4f79-bbd2-7ca7053ece4d", name: "devion-v-0123456789abcdef0123456789abcdef", target: "/data", readOnly: true }],
  });
  const volumeCreate = calls.find((call) => call.path === "/volumes/create");
  expect(volumeCreate?.body).toEqual({
    Name: "devion-v-0123456789abcdef0123456789abcdef",
    Labels: { "devion.managed": "true", "devion.workload-id": "01234567-89ab-cdef-0123-456789abcdef", "devion.volume-id": "46ac6dc2-6c87-4f79-bbd2-7ca7053ece4d" },
  });
  const containerCreate = calls.find((call) => call.path.startsWith("/containers/create?"));
  expect((containerCreate?.body as { HostConfig?: { Mounts?: unknown } }).HostConfig?.Mounts).toEqual([
    { Type: "volume", Source: "devion-v-0123456789abcdef0123456789abcdef", Target: "/data", ReadOnly: true },
  ]);
});

test("deletes only the named volume endpoint", async () => {
  const calls: DockerCall[] = [];
  await mockedRuntime(calls).removeVolume("devion-v-0123456789abcdef0123456789abcdef");
  expect(calls).toEqual([{ method: "DELETE", path: "/volumes/devion-v-0123456789abcdef0123456789abcdef", body: undefined }]);
});

test("publishes TCP and UDP with their separately assigned host ports", async () => {
  const calls: DockerCall[] = [];
  await mockedRuntime(calls).start({
    workloadId: "01234567-89ab-cdef-0123-456789abcdef",
    image: "example/game:latest",
    cpuMilli: 250,
    memoryMib: 256,
    ports: [
      { containerPort: 25565, protocol: "tcp", exposure: "public", externalPort: 32001 },
      { containerPort: 25565, protocol: "udp", exposure: "public", externalPort: 32002 },
      { containerPort: 9000, protocol: "tcp", exposure: "private" },
    ],
  });
  const containerCreate = calls.find((call) => call.path.startsWith("/containers/create?"));
  expect((containerCreate?.body as { HostConfig?: { PortBindings?: unknown } }).HostConfig?.PortBindings).toEqual({
    "25565/tcp": [{ HostIp: "0.0.0.0", HostPort: "32001" }],
    "25565/udp": [{ HostIp: "0.0.0.0", HostPort: "32002" }],
  });
  expect((containerCreate?.body as { ExposedPorts?: unknown }).ExposedPorts).toEqual({ "25565/tcp": {}, "25565/udp": {}, "9000/tcp": {} });
});
