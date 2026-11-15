import type { AppMenuGroupSchema } from './types'

/** The Edit menu: history, clipboard, and selection. */
export const EDIT_MENU: AppMenuGroupSchema = {
  label: 'Edit',
  paletteIcon: 'pencil',
  items: [
    {
      id: 'edit.undo',
      feature: 'document',
      label: 'Undo',
      command: 'edit.undo'
    },
    {
      id: 'edit.redo',
      feature: 'document',
      label: 'Redo',
      command: 'edit.redo'
    },
    { type: 'separator' },
    { id: 'copy', label: 'Copy', shortcut: 'Mod+C' },
    { id: 'cut', label: 'Cut', shortcut: 'Mod+X' },
    { id: 'paste', label: 'Paste', shortcut: 'Mod+V' },
    {
      id: 'paste-to-replace',
      feature: 'document',
      label: 'Paste to replace',
      shortcut: 'Mod+Shift+R'
    },
    {
      id: 'paste-as-layers',
      feature: 'document',
      label: 'Paste as layers'
    },
    {
      id: 'copy-properties',
      feature: 'document',
      label: 'Copy Properties',
      shortcut: 'Mod+Alt+C'
    },
    {
      id: 'paste-properties',
      feature: 'document',
      label: 'Paste Properties',
      shortcut: 'Mod+Alt+V'
    },
    {
      id: 'selection.duplicate',
      feature: 'document',
      label: 'Duplicate',
      command: 'selection.duplicate'
    },
    {
      id: 'selection.delete',
      feature: 'document',
      label: 'Delete',
      command: 'selection.delete'
    },
    {
      id: 'selection.rename',
      feature: 'document',
      label: 'Rename Selection…',
      shortcut: 'Mod+R'
    },
    { type: 'separator' },
    {
      id: 'selection.selectAll',
      feature: 'document',
      label: 'Select All',
      command: 'selection.selectAll'
    },
    {
      id: 'selection.selectInverse',
      feature: 'document',
      label: 'Select Inverse',
      command: 'selection.selectInverse'
    }
  ]
}
