import { VmInstance, VmStatus } from "../types.ts";

export class VmPool {
  private vms: Map<string, VmInstance> = new Map();

  add(vm: VmInstance): void {
    this.vms.set(vm.id, vm);
  }

  get(vmId: string): VmInstance | undefined {
    return this.vms.get(vmId);
  }

  update(vmId: string, updates: Partial<VmInstance>): void {
    const vm = this.vms.get(vmId);
    if (vm) {
      this.vms.set(vmId, { ...vm, ...updates });
    }
  }

  remove(vmId: string): void {
    this.vms.delete(vmId);
  }

  list(): VmInstance[] {
    return Array.from(this.vms.values());
  }

  getByStatus(status: VmStatus): VmInstance[] {
    return this.list().filter((vm) => vm.status === status);
  }
}

export const vmPool = new VmPool();
