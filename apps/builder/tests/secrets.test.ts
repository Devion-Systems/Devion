import { describe, expect, test } from "bun:test";
import { decryptRunSecrets, encryptRunSecrets } from "../src/secrets.ts";

describe("Builder run secrets", () => {
  test("encrypts secrets at rest and restores them only with the same key", async () => {
    const key = "a-builder-secret-encryption-key";
    const encrypted = await encryptRunSecrets({ GIT_TOKEN: "private-token" }, key);
    expect(encrypted.GIT_TOKEN).not.toContain("private-token");
    await expect(decryptRunSecrets(encrypted, key)).resolves.toEqual({ GIT_TOKEN: "private-token" });
    await expect(decryptRunSecrets(encrypted, "another-builder-secret-encryption-key")).rejects.toThrow();
  });
});
