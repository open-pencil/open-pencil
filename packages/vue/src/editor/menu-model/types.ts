import type { EditorCommandId } from '#vue/editor/commands/types'

export interface MenuActionNode {
  separator?: false
  id?: EditorCommandId
  label: string
  shortcut?: string
  action?: () => void
  disabled?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  sub?: MenuEntry[]
}

export interface MenuSeparatorNode {
  separator: true
}

export type MenuEntry = MenuActionNode | MenuSeparatorNode
