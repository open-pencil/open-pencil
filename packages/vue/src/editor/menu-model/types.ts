import type { HotkeyChord } from '@tanstack/hotkeys'
import type { Component } from 'vue'

import type { EditorCommandId } from '#vue/editor/commands/types'
import type { TestId } from '#vue/testing/test-id'

export interface MenuActionNode {
  separator?: false
  menuId?: string
  id?: EditorCommandId
  label: string
  icon?: Component
  /** The shortcut as this platform prints it (`formatShortcut`). */
  shortcut?: string
  paletteShortcut?: HotkeyChord
  action?: () => void
  disabled?: boolean
  testId?: TestId
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  palette?: {
    icon?: Component
    label?: string
    description?: string
    keywords?: string[]
  }
  sub?: MenuEntry[]
}

export interface MenuSeparatorNode {
  separator: true
}

export type MenuEntry = MenuActionNode | MenuSeparatorNode
