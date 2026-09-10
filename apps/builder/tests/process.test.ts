import { expect, test } from "bun:test";
import { MAX_CAPTURED_PROCESS_OUTPUT_BYTES, runProcess } from "../src/process.ts";

test("caps retained and forwarded build output", async () => {
  const forwarded: string[] = [];
  const result = await runProcess(
    [process.execPath, "-e", "process.stdout.write('x'.repeat(131072))"],
    {
      cwd: process.cwd(),
      maxCapturedOutputBytes: 1_024,
      onStdout: (line) => forwarded.push(line),
    },
  );

  expect(result.exitCode).toBe(0);
  expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(1_024);
  expect(forwarded.join("\n")).toContain("output truncated");
});

test("uses a conservative default output cap", () => {
  expect(MAX_CAPTURED_PROCESS_OUTPUT_BYTES).toBe(1_024 * 1_024);
});

test("empty lines consume the output budget", async () => {
  let lines = 0;
  const result = await runProcess([process.execPath, "-e", "process.stdout.write('\\n'.repeat(10000))"], {
    cwd: process.cwd(), maxCapturedOutputBytes: 128, onStdout: () => { lines++; },
  });
  expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(128);
  expect(lines).toBeLessThanOrEqual(129);
});

test("UTF-8 truncation never introduces a replacement character or exceeds the budget", async () => {
  const result = await runProcess([process.execPath, "-e", "process.stdout.write('€'.repeat(100))"], {
    cwd: process.cwd(), maxCapturedOutputBytes: 5,
  });
  expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(5);
  expect(result.stdout).not.toContain("�");
});
