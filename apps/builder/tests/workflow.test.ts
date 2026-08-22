import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { safePath } from "../src/buildkit.ts";
import { interpolate, validateWorkflow } from "../src/workflow.ts";

const workflow = {
  version: 1,
  name: "test",
  steps: [
    { id: "test", run: "bun test" },
    { id: "image", needs: ["test"], build: { context: ".", dockerfile: "Dockerfile", platforms: ["linux/amd64"], tags: ["registry/app:${{ git.sha }}"] } },
  ],
};

describe("workflow validation", () => {
  test("accepts a command and dependent BuildKit step", () => {
    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(true);
    expect(result.checksum).toMatch(/^sha256:/);
  });

  test("accepts a registry deployment step", () => {
    const result = validateWorkflow({
      version: 1,
      name: "deploy",
      steps: [{
        id: "deploy", deploy: {
          image: "registry.example.com/team/api:main", instanceName: "api",
          vcpuCount: 1, memoryMiB: 512, rootfsSizeMiB: 1024,
        },
      }],
    });
    expect(result.valid).toBe(true);
  });

  test("requires all hosting values for manual deployment", () => {
    const result = validateWorkflow({ version: 1, name: "manual", steps: [{ id: "deploy", deploy: { mode: "manual", image: "registry.example.com/team/api:main", instanceName: "api" } }] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.message.includes("Manual deployment requires"))).toBe(true);
  });

  test("accepts YAML and rejects cycles", () => {
    const result = validateWorkflow("version: 1\nname: bad\nsteps:\n  - id: a\n    run: echo a\n    needs: [b]\n  - id: b\n    run: echo b\n    needs: [a]\n");
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.message.includes("cycle"))).toBe(true);
  });

  test("prevents checkout path traversal", () => {
    expect(() => safePath("/tmp/job", "../secret")).toThrow();
    expect(safePath("/tmp/job", "src")).toBe(resolve("/tmp/job", "src"));
  });

  test("interpolates known context without evaluating code", () => {
    expect(interpolate("image:${{ git.sha }}", { "git.sha": "abc" })).toBe("image:abc");
  });
});
