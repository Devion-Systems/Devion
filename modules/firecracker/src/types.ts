export enum VmStatus {
  CREATING = "CREATING",
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
  DELETED = "DELETED",
}

export interface VmConfig {
  id: string;
  imageRef: string;
  vcpuCount: number;
  memSizeMib: number;
  networkIface?: string;
  rootfsPath: string;
  socketPath: string;
  tapDevice?: string;
  ipAddress?: string;
  macAddress?: string;
}

export interface VmInstance extends VmConfig {
  status: VmStatus;
  pid?: number;
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
}

export interface MachineConfig {
  vcpu_count: number;
  mem_size_mib: number;
  smt?: boolean;
  track_dirty_pages?: boolean;
}

export interface BootSource {
  kernel_image_path: string;
  boot_args: string;
  initrd_path?: string;
}

export interface Drive {
  drive_id: string;
  path_on_host: string;
  is_root_device: boolean;
  is_read_only: boolean;
  rate_limiter?: any;
}

export interface NetworkInterface {
  iface_id: string;
  host_dev_name: string;
  guest_mac?: string;
  rx_rate_limiter?: any;
  tx_rate_limiter?: any;
}

export interface VsockDevice {
  guest_cid: number;
  uds_path: string;
}

export interface InstanceActionRequest {
  action_type: "InstanceStart" | "SendCtrlAltDel" | "FlushMetrics";
}

export interface FirecrackerVmInfo {
  id: string;
  state: "Uninitialized" | "Starting" | "Running" | "Paused" | "Halting";
  vmm_version: string;
  app_name: string;
}

export interface CreateVmOptions {
  id?: string;
  imageRef: string;
  vcpuCount?: number;
  memSizeMib?: number;
}
