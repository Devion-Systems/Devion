import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Files for --secret must never be in the repository's COPY/build context. */
export async function withBuildSecrets<T>(
  references: Record<string, string>,
  secrets: Record<string, string>,
  run: (args: string[]) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "devion-build-secrets-"));
  try {
    const args: string[] = [];
    for (const [id, name] of Object.entries(references)) {
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid BuildKit secret ID");
      const value = secrets[name];
      if (value === undefined) throw new Error(`Missing secret: ${name}`);
      const file = join(directory, id);
      await writeFile(file, value, { mode: 0o600, flag: "wx" });
      args.push("--secret", `id=${id},src=${file}`);
    }
    return await run(args);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
