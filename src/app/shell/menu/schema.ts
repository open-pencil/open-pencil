import type { EditorCommandId } from '@open-pencil/vue'

export type AppMenuTarget = 'all' | 'browser' | 'native'

export interface AppMenuActionItem {
  type?: 'item'
  id: string
  label: string
  shortcut?: string
  accelerator?: string
  command?: EditorCommandId
  checkbox?: boolean
  target?: AppMenuTarget
  sub?: AppMenuEntry[]
}

export interface AppMenuSeparatorItem {
  type: 'separator'
  target?: AppMenuTarget
}

export type AppMenuEntry = AppMenuActionItem | AppMenuSeparatorItem

export interface AppMenuGroupSchema {
  label: string
  target?: AppMenuTarget
  items: AppMenuEntry[]
}

export const APP_MENU_SCHEMA = [
  {
    label: 'File',
    items: [
      { id: 'new', label: 'New', shortcut: 'MOD+N', accelerator: 'CmdOrCtrl+N' },
      { id: 'open', label: 'Open…', shortcut: 'MOD+O', accelerator: 'CmdOrCtrl+O' },
      { type: 'separator' },
      { id: 'save', label: 'Save', shortcut: 'MOD+S', accelerator: 'CmdOrCtrl+S' },
      { id: 'save-as', label: 'Save As…', shortcut: 'MOD+⇧S', accelerator: 'CmdOrCtrl+Shift+S' },
      { type: 'separator' },
      {
        id: 'export-selection',
        label: 'Export Selection',
        shortcut: 'MOD+⇧E',
        accelerator: 'CmdOrCtrl+Shift+E',
        sub: [
          { id: 'export-png', label: 'PNG' },
          { id: 'export-svg', label: 'SVG' },
          { id: 'export-fig', label: '.fig' }
        ]
      },
      { type: 'separator' },
      { id: 'autosave', label: 'Autosave', checkbox: true },
      { id: 'close', label: 'Close Tab', shortcut: 'MOD+W', accelerator: 'CmdOrCtrl+W' }
    ]
  },
  {
    label: 'Edit',
    items: [
      {
        id: 'edit.undo',
        label: 'Undo',
        shortcut: 'MOD+Z',
        accelerator: 'CmdOrCtrl+Z',
        command: 'edit.undo'
      },
      {
        id: 'edit.redo',
        label: 'Redo',
        shortcut: 'MOD+⇧Z',
        accelerator: 'CmdOrCtrl+Shift+Z',
        command: 'edit.redo'
      },
      { type: 'separator' },
      { id: 'copy', label: 'Copy', shortcut: 'MOD+C', accelerator: 'CmdOrCtrl+C' },
      { id: 'paste', label: 'Paste', shortcut: 'MOD+V', accelerator: 'CmdOrCtrl+V' },
      {
        id: 'selection.duplicate',
        label: 'Duplicate',
        shortcut: 'MOD+D',
        accelerator: 'CmdOrCtrl+D',
        command: 'selection.duplicate'
      },
      {
        id: 'selection.delete',
        label: 'Delete',
        shortcut: '⌫',
        accelerator: 'Backspace',
        command: 'selection.delete'
      },
      { type: 'separator' },
      {
        id: 'selection.selectAll',
        label: 'Select All',
        shortcut: 'MOD+A',
        accelerator: 'CmdOrCtrl+A',
        command: 'selection.selectAll'
      }
    ]
  },
  {
    label: 'View',
    items: [
      {
        id: 'view.zoom100',
        label: 'Zoom to 100%',
        shortcut: 'MOD+0',
        accelerator: 'CmdOrCtrl+0',
        command: 'view.zoom100'
      },
      {
        id: 'view.zoomFit',
        label: 'Zoom to Fit',
        shortcut: 'MOD+1',
        accelerator: 'CmdOrCtrl+1',
        command: 'view.zoomFit'
      },
      {
        id: 'view.zoomSelection',
        label: 'Zoom to Selection',
        shortcut: 'MOD+2',
        accelerator: 'CmdOrCtrl+2',
        command: 'view.zoomSelection'
      },
      { id: 'zoom-in', label: 'Zoom In', shortcut: 'MOD+=', accelerator: 'CmdOrCtrl+=' },
      { id: 'zoom-out', label: 'Zoom Out', shortcut: 'MOD+-', accelerator: 'CmdOrCtrl+-' },
      { type: 'separator' },
      {
        id: 'theme',
        label: 'Theme',
        sub: [
          { id: 'theme-light', label: 'Light', checkbox: true },
          { id: 'theme-dark', label: 'Dark', checkbox: true },
          { id: 'theme-auto', label: 'Auto', checkbox: true }
        ]
      },
      { id: 'language', label: 'Language', target: 'browser' },
      { type: 'separator' },
      { id: 'toggle-ui', label: 'Toggle UI', shortcut: 'MOD+\\', accelerator: 'CmdOrCtrl+\\' },
      { id: 'profiler', label: 'Profiler', checkbox: true, target: 'browser' },
      {
        id: 'dev-tools',
        label: 'Developer Tools',
        accelerator: 'CmdOrCtrl+Alt+I',
        target: 'native'
      }
    ]
  },
  {
    label: 'Object',
    items: [
      {
        id: 'selection.group',
        label: 'Group Selection',
        shortcut: 'MOD+G',
        accelerator: 'CmdOrCtrl+G',
        command: 'selection.group'
      },
      {
        id: 'selection.ungroup',
        label: 'Ungroup Selection',
        shortcut: 'MOD+⇧G',
        accelerator: 'CmdOrCtrl+Shift+G',
        command: 'selection.ungroup'
      },
      { type: 'separator' },
      {
        id: 'selection.createComponent',
        label: 'Create Component',
        shortcut: 'MOD+⌥K',
        accelerator: 'CmdOrCtrl+Alt+K',
        command: 'selection.createComponent'
      },
      {
        id: 'selection.createComponentSet',
        label: 'Create Component Set',
        command: 'selection.createComponentSet'
      },
      {
        id: 'selection.detachInstance',
        label: 'Detach Instance',
        command: 'selection.detachInstance'
      },
      { type: 'separator' },
      {
        id: 'selection.bringToFront',
        label: 'Bring to Front',
        shortcut: ']',
        accelerator: ']',
        command: 'selection.bringToFront'
      },
      {
        id: 'selection.sendToBack',
        label: 'Send to Back',
        shortcut: '[',
        accelerator: '[',
        command: 'selection.sendToBack'
      }
    ]
  },
  {
    label: 'Text',
    items: [
      { id: 'text.bold', label: 'Bold', shortcut: 'MOD+B', accelerator: 'CmdOrCtrl+B' },
      { id: 'text.italic', label: 'Italic', shortcut: 'MOD+I', accelerator: 'CmdOrCtrl+I' },
      { id: 'text.underline', label: 'Underline', shortcut: 'MOD+U', accelerator: 'CmdOrCtrl+U' }
    ]
  },
  {
    label: 'Arrange',
    items: [
      {
        id: 'selection.wrapInAutoLayout',
        label: 'Wrap in Auto Layout',
        shortcut: '⇧A',
        accelerator: 'Shift+A',
        command: 'selection.wrapInAutoLayout'
      },
      { type: 'separator' },
      { id: 'align-left', label: 'Align Left', shortcut: '⌥A', accelerator: 'Alt+A' },
      { id: 'align-center', label: 'Align Center', shortcut: '⌥H', accelerator: 'Alt+H' },
      { id: 'align-right', label: 'Align Right', shortcut: '⌥D', accelerator: 'Alt+D' },
      { type: 'separator' },
      { id: 'align-top', label: 'Align Top', shortcut: '⌥W', accelerator: 'Alt+W' },
      { id: 'align-middle', label: 'Align Middle', shortcut: '⌥V', accelerator: 'Alt+V' },
      { id: 'align-bottom', label: 'Align Bottom', shortcut: '⌥S', accelerator: 'Alt+S' }
    ]
  }
] satisfies AppMenuGroupSchema[]
