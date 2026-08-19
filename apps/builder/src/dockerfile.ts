/** Extracts numeric TCP/UDP ports from EXPOSE instructions without evaluating shell code. */
export async function inspectDockerfile(path: string): Promise<number[]> {
  const text = await Bun.file(path).text();
  const logicalLines = text.replace(/\\\r?\n/g, " ").split(/\r?\n/);
  const ports = new Set<number>();
  for (const line of logicalLines) {
    const match = /^\s*EXPOSE\s+(.+)$/i.exec(line);
    if (!match) continue;
    const exposed = match[1];
    if (!exposed) continue;
    for (const token of exposed.replace(/\s+#.*$/, "").trim().split(/\s+/)) {
      const port = Number(token.split("/")[0]);
      if (Number.isInteger(port) && port >= 1 && port <= 65_535) ports.add(port);
    }
  }
  return [...ports].sort((left, right) => left - right);
}
