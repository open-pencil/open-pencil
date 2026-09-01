import { tv } from 'tailwind-variants'

import commandPaletteTheme from '@/theme/command-palette'

export const commandPalette = tv(commandPaletteTheme)

export function useCommandPaletteUI() {
  const ui = commandPalette()
  return {
    root: ui.root(),
    searchWrapper: ui.searchWrapper(),
    search: ui.search(),
    back: ui.back(),
    content: ui.content(),
    label: ui.label(),
    group: ui.group(),
    item: ui.item(),
    itemIcon: ui.itemIcon(),
    itemLabel: ui.itemLabel(),
    shortcut: ui.shortcut(),
    key: ui.key()
  }
}
