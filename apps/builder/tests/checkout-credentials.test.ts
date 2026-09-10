import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeCheckoutCredentials } from "../src/executor.ts";

test("removes persisted clone credentials before the checkout becomes a build context", async () => {
  const directory = await mkdtemp(join(tmpdir(), "devion-checkout-test-"));
  try {
    const git = (args: string[]) => {
      const result = Bun.spawnSync(["git", ...args], { cwd: directory });
      expect(result.exitCode).toBe(0);
    };
    git(["init"]);
    git(["remote", "add", "origin", "https://oauth2:fake-test-token@example.test/repo.git"]);
    expect(await readFile(join(directory, ".git/config"), "utf8")).toContain("fake-test-token");
    await removeCheckoutCredentials(directory, "https://example.test/repo.git");
    const config = await readFile(join(directory, ".git/config"), "utf8");
    expect(config).not.toContain("fake-test-token");
    expect(config).toContain("https://example.test/repo.git");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
