export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Build output is controlled by repository code. Keep a single noisy command
 * from retaining arbitrary amounts of memory or filling the build-log table.
 */
export const MAX_CAPTURED_PROCESS_OUTPUT_BYTES = 1_024 * 1_024;
const MAX_PENDING_PROCESS_LINE_BYTES = 64 * 1_024;

export async function runProcess(
  command: string[],
  options: {
    cwd: string;
    env?: Record<string, string>;
    signal?: AbortSignal;
    onStdout?: (line: string) => void;
    onStderr?: (line: string) => void;
    /** Defaults to 1 MiB across stdout and stderr. */
    maxCapturedOutputBytes?: number;
  },
): Promise<ProcessResult> {
  const outputLimit = options.maxCapturedOutputBytes ?? MAX_CAPTURED_PROCESS_OUTPUT_BYTES;
  if (!Number.isSafeInteger(outputLimit) || outputLimit < 1) throw new RangeError("Invalid process output limit");
  const child = Bun.spawn(command, {
    cwd: options.cwd,
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "/tmp", ...(options.env ?? {}) },
    stdout: "pipe",
    stderr: "pipe",
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const stdout: string[] = [];
  const stderr: string[] = [];
  let remainingOutputBytes = outputLimit;
  let truncationReported = false;
  const reportTruncation = (callback?: (line: string) => void) => {
    if (truncationReported) return;
    truncationReported = true;
    callback?.("[output truncated after configured limit]");
  };
  const retain = (line: string, target: string[], callback?: (line: string) => void) => {
    if (remainingOutputBytes <= 0) {
      reportTruncation(callback);
      return;
    }
    // Charge a delimiter even for empty lines, bounding both text and the
    // number of retained entries / log callbacks.
    const bytes = Buffer.byteLength(line) + 1;
    if (bytes <= remainingOutputBytes) {
      remainingOutputBytes -= bytes;
      target.push(line);
      callback?.(line);
      return;
    }
    // Preserve only complete UTF-8 characters in the final retained chunk.
    const retained = new TextDecoder().decode(
      Buffer.from(line).subarray(0, Math.max(0, remainingOutputBytes - 1)),
      { stream: true },
    );
    if (retained) {
      target.push(retained);
      callback?.(retained);
    }
    remainingOutputBytes = 0;
    reportTruncation(callback);
  };
  const consume = async (stream: ReadableStream<Uint8Array>, target: string[], callback?: (line: string) => void) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (remainingOutputBytes <= 0) { reportTruncation(callback); pending = ""; continue; }
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) retain(line, target, callback);
      // A process is not required to emit newlines. Flush oversized partial
      // lines so a malicious or broken command cannot grow `pending` forever.
      if (Buffer.byteLength(pending) >= MAX_PENDING_PROCESS_LINE_BYTES) {
        retain(pending, target, callback);
        pending = "";
      }
    }
    if (pending) retain(pending, target, callback);
  };
  await Promise.all([consume(child.stdout, stdout, options.onStdout), consume(child.stderr, stderr, options.onStderr)]);
  return { exitCode: await child.exited, stdout: stdout.join("\n"), stderr: stderr.join("\n") };
}
