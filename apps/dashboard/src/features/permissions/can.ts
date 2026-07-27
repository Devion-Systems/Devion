// features/permissions/can.ts
import { PERMISSIONS, type Permission } from './constants'
import type { Membership } from '@/features/organizations/types'

export function can(membership: Membership, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(membership.role)
}