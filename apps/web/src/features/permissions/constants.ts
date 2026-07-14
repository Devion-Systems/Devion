export const ROLES = ['owner', 'admin', 'member'] as const
export type Role = typeof ROLES[number]

export const PERMISSIONS = {
  'project:deploy': ['owner', 'admin', 'member'],
  'project:delete': ['owner', 'admin'],
  'hardware:manage': ['owner', 'admin'],
  'org:billing': ['owner'],
  'org:delete': ['owner'],
  'team:invite': ['owner', 'admin'],
} as const

export type Permission = keyof typeof PERMISSIONS