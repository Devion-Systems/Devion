import { AppError, ErrorCode, getLogger } from "@repo/core";
import { spawn } from "bun";

export class TapManager {
  async createTap(tapName: string, bridgeName?: string): Promise<void> {
    let logger;
    try {
      logger = getLogger();
    } catch {}

    try {
      logger?.info({ tapName, bridgeName }, "Creating tap interface");
      
      const addProc = spawn(["ip", "tuntap", "add", "dev", tapName, "mode", "tap"], { stdout: "pipe", stderr: "pipe" });
      await addProc.exited;
      if (addProc.exitCode !== 0) {
          throw new Error(`Failed to add tap: ${await new Response(addProc.stderr).text()}`);
      }

      if (bridgeName) {
          const masterProc = spawn(["ip", "link", "set", tapName, "master", bridgeName], { stdout: "pipe", stderr: "pipe" });
          await masterProc.exited;
          if (masterProc.exitCode !== 0) {
              throw new Error(`Failed to set master bridge: ${await new Response(masterProc.stderr).text()}`);
          }
      }

      const upProc = spawn(["ip", "link", "set", tapName, "up"], { stdout: "pipe", stderr: "pipe" });
      await upProc.exited;
      if (upProc.exitCode !== 0) {
          throw new Error(`Failed to bring tap up: ${await new Response(upProc.stderr).text()}`);
      }
    } catch (error: any) {
        throw new AppError(`Failed to create TAP interface ${tapName}: ${error.message}`, ErrorCode.INTERNAL_ERROR, 500);
    }
  }

  async deleteTap(tapName: string): Promise<void> {
      try {
          const delProc = spawn(["ip", "link", "delete", tapName], { stdout: "pipe", stderr: "pipe" });
          await delProc.exited;
      } catch (error: any) {
          throw new AppError(`Failed to delete TAP interface ${tapName}: ${error.message}`, ErrorCode.INTERNAL_ERROR, 500);
      }
  }

  async tapExists(tapName: string): Promise<boolean> {
      const proc = spawn(["ip", "link", "show", tapName], { stdout: "pipe", stderr: "pipe" });
      await proc.exited;
      return proc.exitCode === 0;
  }

  async listTaps(): Promise<string[]> {
      const proc = spawn(["ip", "-o", "link", "show", "type", "tap"], { stdout: "pipe", stderr: "pipe" });
      await proc.exited;
      if (proc.exitCode !== 0) return [];
      
      const output = await new Response(proc.stdout).text();
      return output.split("\n")
          .filter((line: string) => line.trim().length > 0)
          .map((line: string) => line.split(":")[1].trim().split("@")[0]);
  }

  generateTapName(vmId: string): string {
      return `tap-${vmId.slice(0, 8)}`;
  }
}
