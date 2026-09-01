import type { Component } from 'vue'

export interface CommandPaletteShortcut {
  keys: string[]
}

export interface CommandPaletteItem {
  id: string
  label: string
  description?: string
  keywords?: string[]
  icon?: Component
  shortcut?: CommandPaletteShortcut
  disabled?: boolean
  children?: CommandPaletteItem[]
  onSelect?: () => void
}

export interface CommandPaletteGroup {
  id: string
  label?: string
  items: CommandPaletteItem[]
}

export interface CommandPaletteLabels {
  searchPlaceholder: string
  searchLabel: string
  paletteLabel: string
  empty: string
  back: string
}

export interface CommandPaletteUI {
  root?: string
  searchWrapper?: string
  search?: string
  back?: string
  content?: string
  viewport?: string
  group?: string
  label?: string
  item?: string
  itemIcon?: string
  itemLabel?: string
  itemDescription?: string
  shortcut?: string
  key?: string
  empty?: string
}

export interface UseCommandPaletteOptions {
  groups: CommandPaletteGroup[]
  resultLimit?: number
}
