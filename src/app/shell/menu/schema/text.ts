import type { AppMenuGroupSchema } from './types'

/** The Text menu: character styles for the text being edited. */
export const TEXT_MENU: AppMenuGroupSchema = {
  label: 'Text',
  feature: 'document',
  paletteIcon: 'type',
  items: [
    { id: 'text.bold', label: 'Bold', shortcut: 'Mod+B' },
    { id: 'text.italic', label: 'Italic', shortcut: 'Mod+I' },
    { id: 'text.underline', label: 'Underline', shortcut: 'Mod+U' }
  ]
}
