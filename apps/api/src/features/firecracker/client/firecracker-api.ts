import { AppError, ErrorCode, getLogger } from "@repo/core";
import {
  MachineConfig,
  BootSource,
  Drive,
  NetworkInterface,
  InstanceActionRequest,
  FirecrackerVmInfo,
} from "../types.ts";
import http from "http";

export class FirecrackerApiClient {
  private socketPath: string;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  private request(method: string, path: string, body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        socketPath: this.socketPath,
        path: path,
        method: method,
        headers: body ? { "Content-Type": "application/json" } : {},
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            if (res.statusCode === 204 || data.length === 0) {
              resolve(null);
            } else {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                resolve(data);
              }
            }
          } else {
            reject(new AppError(`Firecracker API error: ${res.statusCode} - ${data}`, ErrorCode.INTERNAL_ERROR, res.statusCode || 500));
          }
        });
      });

      req.on("error", (e) => {
        reject(new AppError(`Failed to communicate with Firecracker API at ${this.socketPath}: ${e.message}`, ErrorCode.INTERNAL_ERROR, 500));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  async setMachineConfig(config: MachineConfig): Promise<void> {
    await this.request("PUT", "/machine-config", config);
  }

  async setBootSource(boot: BootSource): Promise<void> {
    await this.request("PUT", "/boot-source", boot);
  }

  async addDrive(drive: Drive): Promise<void> {
    await this.request("PUT", `/drives/${drive.drive_id}`, drive);
  }

  async addNetworkInterface(iface: NetworkInterface): Promise<void> {
    await this.request("PUT", `/network-interfaces/${iface.iface_id}`, iface);
  }

  async startInstance(): Promise<void> {
    const action: InstanceActionRequest = { action_type: "InstanceStart" };
    await this.request("PUT", "/actions", action);
  }

  async pauseInstance(): Promise<void> {
    await this.request("PATCH", "/vm", { state: "Paused" });
  }

  async resumeInstance(): Promise<void> {
    await this.request("PATCH", "/vm", { state: "Resumed" });
  }

  async getVmInfo(): Promise<FirecrackerVmInfo> {
    return await this.request("GET", "/");
  }

  async createSnapshot(snapshotPath: string, memPath: string): Promise<void> {
    await this.request("PUT", "/snapshot/create", { snapshot_path: snapshotPath, mem_file_path: memPath });
  }

  async loadSnapshot(snapshotPath: string, memPath: string, resume: boolean = true): Promise<void> {
    await this.request("PUT", "/snapshot/load", { snapshot_path: snapshotPath, mem_backend: { backend_path: memPath, backend_type: "File" }, enable_diff_snapshots: false, resume_vm: resume });
  }
}
