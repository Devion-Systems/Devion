export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runProcess(
  command: string[],
  options: { cwd: string; env?: Record<string, string>; signal?: AbortSignal; onStdout?: (line: string) => void; onStderr?: (line: string) => void },
): Promise<ProcessResult> {
  const child = Bun.spawn(command, {
    cwd: options.cwd,
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "/tmp", ...(options.env ?? {}) },
    stdout: "pipe",
    stderr: "pipe",
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const stdout: string[] = [];
  const stderr: string[] = [];
  const consume = async (stream: ReadableStream<Uint8Array>, target: string[], callback?: (line: string) => void) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) { target.push(line); callback?.(line); }
    }
    if (pending) { target.push(pending); callback?.(pending); }
  };
  await Promise.all([consume(child.stdout, stdout, options.onStdout), consume(child.stderr, stderr, options.onStderr)]);
  return { exitCode: await child.exited, stdout: stdout.join("\n"), stderr: stderr.join("\n") };
}
