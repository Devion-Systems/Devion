import { expect, test } from "bun:test";
import { normalizeAdvertisedAddress, workloadUpstreamUrl } from "./safe-address.js";

test("only accepts a bare operator-advertised host or IP", () => {
  expect(normalizeAdvertisedAddress("NODE.Example.Internal")).toBe("node.example.internal");
  expect(normalizeAdvertisedAddress("2001:db8::10")).toBe("2001:db8::10");
  expect(() => normalizeAdvertisedAddress("http://10.0.0.2:8080/path")).toThrow();
  expect(() => normalizeAdvertisedAddress("docker-host:3000")).toThrow();
});

test("formats IPv6 workload upstreams with the reported dynamic host port", () => {
  expect(workloadUpstreamUrl("http", "2001:db8::10", 49152)).toBe("http://[2001:db8::10]:49152");
});
