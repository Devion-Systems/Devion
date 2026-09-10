import { expect, test } from "bun:test";
import { access, readFile, stat } from "node:fs/promises";
import { withBuildSecrets } from "../src/build-secrets.ts";

test("secret files have private permissions and are removed after build failure", async () => {
  let path = "";
  await expect(withBuildSecrets({ token: "TOKEN" }, { TOKEN: "test-secret" }, async (args) => {
    path = args[1]!.split("src=")[1]!;
    expect(path).not.toContain(".devion-secrets");
    expect(await readFile(path, "utf8")).toBe("test-secret");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    throw new Error("build failed");
  })).rejects.toThrow("build failed");
  await expect(access(path)).rejects.toThrow();
});

test("concurrent builds use separate secret files", async () => {
  const paths: string[] = [];
  await Promise.all(["one", "two"].map(value => withBuildSecrets({ token: "TOKEN" }, { TOKEN: value }, async args => {
    const path = args[1]!.split("src=")[1]!;
    paths.push(path);
    expect(await readFile(path, "utf8")).toBe(value);
  })));
  expect(new Set(paths).size).toBe(2);
});

test("rejects path traversal in secret IDs", async () => {
  await expect(withBuildSecrets({ "../escape": "TOKEN" }, { TOKEN: "secret" }, async () => {})).rejects.toThrow("Invalid BuildKit secret ID");
});
