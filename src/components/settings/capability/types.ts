/**
 * What the AI can use, as the capability lists in Settings show it: tools, skills. Each page maps
 * its own records onto these and decides what switching a group or an item does.
 */
export interface CapabilityItem {
  key: string
  /** An identifier such as `get_selection` or `brand-review`, shown in code type. */
  name: string
  description: string
  enabled: boolean
  /** The switch cannot change now, such as a skill whose folder is off. */
  locked?: boolean
  /** Why it does not apply despite its switch, such as "Not used". */
  note?: string
}

export interface CapabilityGroup {
  key: string
  label: string
  /** Where the group comes from, such as a folder, shown under its name. */
  detail?: string
  /** How many of its items are on, such as "2 of 7 enabled". */
  count?: string
  /** The group's own switch, or none when something else turns it on, such as trusting it. */
  toggle: { enabled: boolean; state: 'mixed' | 'idle' } | null
  items: CapabilityItem[]
  /** Shown in place of items when the group has none. */
  empty?: string
}

/** Which items a capability page lists: all of them, or only those on or off. */
export type CapabilityFilter = 'all' | 'enabled' | 'disabled'
