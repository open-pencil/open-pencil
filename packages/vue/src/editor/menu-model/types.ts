export interface MenuActionNode {
  separator?: false
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
