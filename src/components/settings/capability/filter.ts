import type { CapabilityFilter, CapabilityGroup } from './types'

/**
 * Keeps the items the filter shows. A filtered group says nothing when none are left, so the list
 * hides it rather than calling it empty.
 */
export function filterCapabilities(
  groups: CapabilityGroup[],
  show: CapabilityFilter
): CapabilityGroup[] {
  if (show === 'all') return groups
  const enabled = show === 'enabled'
  return groups.map(({ empty: _empty, ...group }) => ({
    ...group,
    items: group.items.filter((item) => item.enabled === enabled)
  }))
}
