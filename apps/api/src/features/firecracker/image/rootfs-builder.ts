import { AppError, ErrorCode, getLogger } from "@repo/core";
import { mkdir, rm } from "fs/promises";
import { spawn } from "bun";

export class RootfsBuilder {
  async buildRootfs(imageRef: string, outputPath: string): Promise<string> {
    let logger;
    try {
      logger = getLogger();
    } catch {}

    const tmpDir = `${outputPath}.tmp-mnt`;
    let containerId: string | null = null;
    
    try {
      logger?.info({ imageRef }, "Pulling docker image");
      const pullProc = spawn(["docker", "pull", imageRef], { stdout: "pipe", stderr: "pipe" });
      await pullProc.exited;
      if (pullProc.exitCode !== 0) {
          throw new Error(`Failed to pull image: ${await new Response(pullProc.stderr).text()}`);
      }

      logger?.info({ imageRef }, "Creating temp docker container");
      const createProc = spawn(["docker", "create", imageRef], { stdout: "pipe", stderr: "pipe" });
      await createProc.exited;
      if (createProc.exitCode !== 0) {
         throw new Error(`Failed to create container: ${await new Response(createProc.stderr).text()}`);
      }
      containerId = (await new Response(createProc.stdout).text()).trim();

      await mkdir(tmpDir, { recursive: true });
      logger?.info({ containerId, tmpDir }, "Exporting container filesystem");
      const exportProc = spawn(["bash", "-c", `docker export ${containerId} | tar -xf - -C ${tmpDir}`], { stdout: "pipe", stderr: "pipe" });
      await exportProc.exited;
      if (exportProc.exitCode !== 0) {
          throw new Error(`Failed to export/tar container: ${await new Response(exportProc.stderr).text()}`);
      }

      logger?.info({ outputPath }, "Creating ext4 image");
      const sizeMb = 1024;
      const ddProc = spawn(["dd", "if=/dev/zero", `of=${outputPath}`, "bs=1M", `count=${sizeMb}`], { stdout: "pipe", stderr: "pipe" });
      await ddProc.exited;
      if (ddProc.exitCode !== 0) {
          throw new Error(`Failed to create image file: ${await new Response(ddProc.stderr).text()}`);
      }
      
      const mkfsProc = spawn(["mkfs.ext4", "-F", outputPath], { stdout: "pipe", stderr: "pipe" });
      await mkfsProc.exited;
      if (mkfsProc.exitCode !== 0) {
          throw new Error(`Failed to format ext4 image: ${await new Response(mkfsProc.stderr).text()}`);
      }

      const mntDir = `${outputPath}.mnt`;
      await mkdir(mntDir, { recursive: true });
      logger?.info({ outputPath, mntDir }, "Mounting and copying files");
      
      const mountProc = spawn(["mount", "-o", "loop", outputPath, mntDir], { stdout: "pipe", stderr: "pipe" });
      await mountProc.exited;
      if (mountProc.exitCode !== 0) {
          throw new Error(`Failed to mount image: ${await new Response(mountProc.stderr).text()}`);
      }

      const cpProc = spawn(["cp", "-a", `${tmpDir}/.`, `${mntDir}/`], { stdout: "pipe", stderr: "pipe" });
      await cpProc.exited;
      
      const umountProc = spawn(["umount", mntDir], { stdout: "pipe", stderr: "pipe" });
      await umountProc.exited;
      await rm(mntDir, { recursive: true, force: true });
      
      if (cpProc.exitCode !== 0) {
          throw new Error(`Failed to copy files: ${await new Response(cpProc.stderr).text()}`);
      }

      return outputPath;
    } catch (error: any) {
      logger?.error({ error: error.message }, "Error building rootfs");
      throw new AppError(`Failed to build rootfs: ${error.message}`, ErrorCode.INTERNAL_ERROR, 500);
    } finally {
        if (containerId) {
            const rmProc = spawn(["docker", "rm", "-v", containerId], { stdout: "pipe", stderr: "pipe" });
            await rmProc.exited;
        }
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
