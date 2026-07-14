// features/permissions/filter-nav.ts
import { can } from './can'
import type { NavGroup } from '@/config/nav'
import type { Membership } from '@/features/organizations/types'

export function filterNavGroups(groups: NavGroup[], membership: Membership): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || can(membership, item.permission)
      ),
    }))
    .filter((group) => group.items.length > 0)   // leere Gruppen komplett ausblenden
}