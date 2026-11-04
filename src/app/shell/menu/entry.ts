import type { MenuActionNode, MenuEntry } from '@open-pencil/vue/editor/menu-model'

export function isMenuSeparator(entry: MenuEntry) {
  return 'separator' in entry && entry.separator
}

export function isMenuAction(entry: MenuEntry): entry is MenuActionNode {
  return !isMenuSeparator(entry)
}

/**
 * The entries a menu shows, without the separators that hidden items leave at its ends or next
 * to each other, as on Home, where the document's items are gone.
 */
export function visibleMenuEntries(entries: readonly (MenuEntry | null)[]): MenuEntry[] {
  const result: MenuEntry[] = []
  for (const entry of entries) {
    if (entry === null) continue
    const previous = result.at(-1)
    if (isMenuSeparator(entry) && (previous === undefined || isMenuSeparator(previous))) continue
    result.push(entry)
  }
  const last = result.at(-1)
  if (last !== undefined && isMenuSeparator(last)) result.pop()
  return result
}

export function menuLabel(entry: MenuEntry) {
  return isMenuAction(entry) ? entry.label : ''
}

export function menuShortcut(entry: MenuEntry) {
  return isMenuAction(entry) ? entry.shortcut : undefined
}

export function menuDisabled(entry: MenuEntry) {
  return isMenuAction(entry) ? entry.disabled : undefined
}

export function menuSubItems(entry: MenuEntry) {
  return isMenuAction(entry) ? (entry.sub ?? []) : []
}

export function hasMenuSubItems(entry: MenuEntry) {
  return menuSubItems(entry).length > 0
}

export function isMenuCheckbox(entry: MenuEntry) {
  return isMenuAction(entry) && Boolean(entry.onCheckedChange)
}

export function menuChecked(entry: MenuEntry) {
  return isMenuAction(entry) ? entry.checked : undefined
}

export function updateMenuChecked(entry: MenuEntry, checked: boolean) {
  if (isMenuAction(entry)) entry.onCheckedChange?.(checked)
}

export function runMenuAction(entry: MenuEntry) {
  if (isMenuAction(entry)) entry.action?.()
}
