import { AppError, ErrorCode, getLogger } from "@repo/core";
import { CreateVmOptions, VmInstance, VmStatus } from "../types.ts";
import { vmPool } from "./vm-pool.ts";
import { config } from "../config.ts";
import { FirecrackerApiClient } from "../client/firecracker-api.ts";
import { RootfsBuilder } from "../image/rootfs-builder.ts";
import { TapManager } from "../network/tap-manager.ts";
import { join } from "path";
import { mkdir, rm, access } from "fs/promises";
import { spawn, Subprocess } from "bun";

export class VmManager {
  private rootfsBuilder: RootfsBuilder;
  private tapManager: TapManager;
  private ipCounter: number = 2;

  constructor() {
    this.rootfsBuilder = new RootfsBuilder();
    this.tapManager = new TapManager();
  }

  private allocateIp(): string {
    const base = config.FIRECRACKER_SUBNET.split("/")[0].split(".");
    base[3] = this.ipCounter.toString();
    this.ipCounter++;
    return base.join(".");
  }

  private generateMac(): string {
    const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    return `02:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`;
  }

  private async waitForSocket(socketPath: string, timeoutMs: number = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        await access(socketPath);
        return;
      } catch {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    throw new AppError(`Timeout waiting for firecracker socket at ${socketPath}`, ErrorCode.INTERNAL_ERROR, 500);
  }

  private async spawnFirecracker(socketPath: string): Promise<{ process: Subprocess; pid: number }> {
    await rm(socketPath, { force: true }).catch(() => {});
    
    let logger;
    try {
      logger = getLogger();
    } catch {}

    logger?.info({ socketPath }, "Spawning firecracker process");
    
    const proc = spawn([config.FIRECRACKER_BINARY_PATH, "--api-sock", socketPath], {
      stdout: "pipe",
      stderr: "pipe"
    });

    await this.waitForSocket(socketPath);
    
    return { process: proc, pid: proc.pid as number };
  }

  async createVm(options: CreateVmOptions): Promise<VmInstance> {
    const vmId = options.id || crypto.randomUUID();
    let logger;
    try {
      logger = getLogger();
    } catch {}

    logger?.info({ vmId }, "Creating VM");

    const vcpuCount = options.vcpuCount || config.FIRECRACKER_DEFAULT_VCPUS;
    const memSizeMib = options.memSizeMib || config.FIRECRACKER_DEFAULT_MEMORY_MIB;
    
    const socketPath = join(config.FIRECRACKER_SOCKET_DIR, `${vmId}.socket`);
    const rootfsPath = join(config.FIRECRACKER_ROOTFS_DIR, `${vmId}.ext4`);
    const tapDevice = this.tapManager.generateTapName(vmId);
    const ipAddress = this.allocateIp();
    const macAddress = this.generateMac();

    await mkdir(config.FIRECRACKER_SOCKET_DIR, { recursive: true });
    await mkdir(config.FIRECRACKER_ROOTFS_DIR, { recursive: true });

    const vm: VmInstance = {
      id: vmId,
      imageRef: options.imageRef,
      vcpuCount,
      memSizeMib,
      rootfsPath,
      socketPath,
      tapDevice,
      ipAddress,
      macAddress,
      status: VmStatus.CREATING,
      createdAt: new Date(),
    };
    
    vmPool.add(vm);

    try {
      await this.rootfsBuilder.buildRootfs(options.imageRef, rootfsPath);
      await this.tapManager.createTap(tapDevice, config.FIRECRACKER_TAP_BRIDGE);

      const fc = await this.spawnFirecracker(socketPath);
      vmPool.update(vmId, { pid: fc.pid });

      const client = new FirecrackerApiClient(socketPath);
      
      await client.setMachineConfig({
        vcpu_count: vcpuCount,
        mem_size_mib: memSizeMib
      });

      const bootArgs = `console=ttyS0 reboot=k panic=1 pci=off ip=${ipAddress}::${config.FIRECRACKER_SUBNET.split('/')[0]}::${vmId}:eth0:off`;
      
      await client.setBootSource({
        kernel_image_path: config.FIRECRACKER_KERNEL_PATH,
        boot_args: bootArgs
      });

      await client.addDrive({
        drive_id: "rootfs",
        path_on_host: rootfsPath,
        is_root_device: true,
        is_read_only: false
      });

      await client.addNetworkInterface({
        iface_id: "eth0",
        host_dev_name: tapDevice,
        guest_mac: macAddress
      });

      await client.startInstance();
      
      vmPool.update(vmId, { status: VmStatus.RUNNING, startedAt: new Date() });
      return vmPool.get(vmId)!;
    } catch (error: any) {
      vmPool.update(vmId, { status: VmStatus.ERROR });
      throw new AppError(`Failed to create VM ${vmId}: ${error.message}`, ErrorCode.INTERNAL_ERROR, 500);
    }
  }

  async startVm(vmId: string): Promise<void> {
      throw new AppError("Starting a stopped VM requires recreation in Firecracker", ErrorCode.BAD_REQUEST, 400);
  }

  async stopVm(vmId: string): Promise<void> {
    const vm = vmPool.get(vmId);
    if (!vm) throw new AppError("VM not found", ErrorCode.NOT_FOUND, 404);

    if (vm.pid) {
      try {
        process.kill(vm.pid, "SIGTERM");
      } catch (e) {}
    }
    
    vmPool.update(vmId, { status: VmStatus.STOPPED, stoppedAt: new Date() });
  }

  async pauseVm(vmId: string): Promise<void> {
      const vm = vmPool.get(vmId);
      if (!vm) throw new AppError("VM not found", ErrorCode.NOT_FOUND, 404);
      
      const client = new FirecrackerApiClient(vm.socketPath);
      await client.pauseInstance();
      vmPool.update(vmId, { status: VmStatus.PAUSED });
  }

  async resumeVm(vmId: string): Promise<void> {
      const vm = vmPool.get(vmId);
      if (!vm) throw new AppError("VM not found", ErrorCode.NOT_FOUND, 404);
      
      const client = new FirecrackerApiClient(vm.socketPath);
      await client.resumeInstance();
      vmPool.update(vmId, { status: VmStatus.RUNNING });
  }

  async deleteVm(vmId: string): Promise<void> {
    const vm = vmPool.get(vmId);
    if (!vm) throw new AppError("VM not found", ErrorCode.NOT_FOUND, 404);

    if (vm.status === VmStatus.RUNNING || vm.status === VmStatus.PAUSED) {
      await this.stopVm(vmId);
    }

    if (vm.tapDevice) {
        await this.tapManager.deleteTap(vm.tapDevice).catch(() => {});
    }

    await rm(vm.socketPath, { force: true }).catch(() => {});
    await rm(vm.rootfsPath, { force: true }).catch(() => {});
    
    vmPool.update(vmId, { status: VmStatus.DELETED });
    vmPool.remove(vmId);
  }

  async getVm(vmId: string): Promise<VmInstance | null> {
    return vmPool.get(vmId) || null;
  }

  async listVms(): Promise<VmInstance[]> {
    return vmPool.list();
  }
}
