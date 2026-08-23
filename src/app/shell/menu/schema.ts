import type { EditorCommandId } from '@open-pencil/vue'

export type AppMenuTarget = 'all' | 'browser' | 'native'
export type AppMenuHandler = 'editor' | 'shell'

export interface AppMenuActionItem {
  type?: 'item'
  id: string
  label: string
  shortcut?: string
  accelerator?: string
  command?: EditorCommandId
  checkbox?: boolean
  target?: AppMenuTarget
  handler?: AppMenuHandler
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
      { id: 'new', label: 'New', shortcut: 'MOD+N' },
      { id: 'open', label: 'Open…', shortcut: 'MOD+O' },
      { id: 'open-recent', label: 'Open Recent', target: 'native' },
      { id: 'open-storage-workspace', label: 'Open Storage Workspace…', handler: 'shell' },
      { type: 'separator' },
      { id: 'save', label: 'Save', shortcut: 'MOD+S' },
      { id: 'save-as', label: 'Save As…', shortcut: 'MOD+SHIFT+S' },
      { type: 'separator' },
      {
        id: 'export-selection',
        label: 'Export Selection',
        shortcut: 'MOD+SHIFT+E',
        sub: [
          { id: 'export-png', label: 'PNG' },
          { id: 'export-svg', label: 'SVG' },
          { id: 'export-pptx', label: 'PPTX' },
          { id: 'export-fig', label: '.fig' }
        ]
      },
      { type: 'separator' },
      { id: 'autosave', label: 'Autosave', checkbox: true },
      { id: 'close', label: 'Close Tab', shortcut: 'MOD+W' }
    ]
  },
  {
    label: 'Edit',
    items: [
      {
        id: 'edit.undo',
        label: 'Undo',
        command: 'edit.undo'
      },
      {
        id: 'edit.redo',
        label: 'Redo',
        command: 'edit.redo'
      },
      { type: 'separator' },
      { id: 'copy', label: 'Copy', shortcut: 'MOD+C' },
      { id: 'cut', label: 'Cut', shortcut: 'MOD+X' },
      { id: 'paste', label: 'Paste', shortcut: 'MOD+V' },
      { id: 'paste-to-replace', label: 'Paste to replace', shortcut: 'MOD+SHIFT+R' },
      {
        id: 'selection.duplicate',
        label: 'Duplicate',
        command: 'selection.duplicate'
      },
      {
        id: 'selection.delete',
        label: 'Delete',
        command: 'selection.delete'
      },
      { id: 'selection.rename', label: 'Rename Selection…', shortcut: 'MOD+R' },
      { type: 'separator' },
      {
        id: 'selection.selectAll',
        label: 'Select All',
        command: 'selection.selectAll'
      },
      {
        id: 'selection.selectInverse',
        label: 'Select Inverse',
        command: 'selection.selectInverse'
      }
    ]
  },
  {
    label: 'View',
    items: [
      {
        id: 'view.zoom100',
        label: 'Zoom to 100%',
        command: 'view.zoom100'
      },
      {
        id: 'view.zoomFit',
        label: 'Zoom to Fit',
        command: 'view.zoomFit'
      },
      {
        id: 'view.zoomSelection',
        label: 'Zoom to Selection',
        command: 'view.zoomSelection'
      },
      { id: 'zoom-in', label: 'Zoom In', shortcut: 'MOD+=' },
      { id: 'zoom-out', label: 'Zoom Out', shortcut: 'MOD+-' },
      { type: 'separator' },
      { id: 'view-split-right', label: 'Split Right' },
      { id: 'view-split-down', label: 'Split Down' },
      { type: 'separator' },
      { id: 'view-rulers', label: 'Rulers', checkbox: true },
      { id: 'view-multiplayer-cursors', label: 'Multiplayer Cursors', checkbox: true },
      { type: 'separator' },
      {
        id: 'theme',
        label: 'Theme',
        sub: [
          { id: 'theme-light', label: 'Light', checkbox: true, handler: 'shell' },
          { id: 'theme-dark', label: 'Dark', checkbox: true, handler: 'shell' },
          { id: 'theme-auto', label: 'Auto', checkbox: true, handler: 'shell' }
        ]
      },
      { id: 'language', label: 'Language', target: 'browser' },
      { type: 'separator' },
      {
        id: 'preferences',
        label: 'Preferences',
        sub: [
          {
            id: 'snap-geometry',
            label: 'Snap to Geometry',
            checkbox: true,
            handler: 'shell'
          },
          {
            id: 'snap-objects',
            label: 'Snap to Objects',
            checkbox: true,
            handler: 'shell'
          },
          {
            id: 'snap-pixel-grid',
            label: 'Snap to Pixel Grid',
            checkbox: true,
            handler: 'shell'
          },
          { type: 'separator' },
          {
            id: 'settings',
            label: 'Settings…',
            shortcut: 'MOD+,',
            accelerator: 'CmdOrCtrl+,',
            handler: 'shell'
          }
        ]
      },
      { type: 'separator' },
      { id: 'toggle-ui', label: 'Toggle UI', shortcut: 'MOD+\\' },
      { type: 'separator' },
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
        command: 'selection.group'
      },
      {
        id: 'selection.frameSelection',
        label: 'Frame Selection',
        command: 'selection.frameSelection'
      },
      {
        id: 'selection.ungroup',
        label: 'Ungroup Selection',
        command: 'selection.ungroup'
      },
      { type: 'separator' },
      {
        id: 'selection.toggleMask',
        label: 'Use as Mask',
        command: 'selection.toggleMask'
      },
      {
        id: 'selection.toggleVisibility',
        label: 'Show/Hide',
        command: 'selection.toggleVisibility'
      },
      {
        id: 'selection.toggleLock',
        label: 'Lock/Unlock',
        command: 'selection.toggleLock'
      },
      { type: 'separator' },
      {
        id: 'selection.flipHorizontal',
        label: 'Flip Horizontal',
        command: 'selection.flipHorizontal'
      },
      {
        id: 'selection.flipVertical',
        label: 'Flip Vertical',
        command: 'selection.flipVertical'
      },
      { type: 'separator' },
      {
        id: 'selection.booleanUnion',
        label: 'Union selection',
        command: 'selection.booleanUnion'
      },
      {
        id: 'selection.booleanSubtract',
        label: 'Subtract selection',
        command: 'selection.booleanSubtract'
      },
      {
        id: 'selection.booleanIntersect',
        label: 'Intersect selection',
        command: 'selection.booleanIntersect'
      },
      {
        id: 'selection.booleanExclude',
        label: 'Exclude selection',
        command: 'selection.booleanExclude'
      },
      {
        id: 'selection.flatten',
        label: 'Flatten',
        command: 'selection.flatten'
      },
      {
        id: 'selection.outlineText',
        label: 'Outline text',
        command: 'selection.outlineText'
      },
      {
        id: 'selection.outlineStroke',
        label: 'Outline stroke',
        command: 'selection.outlineStroke'
      },
      { type: 'separator' },
      {
        id: 'selection.createComponent',
        label: 'Create Component',
        command: 'selection.createComponent'
      },
      {
        id: 'selection.createComponentSet',
        label: 'Create Component Set',
        command: 'selection.createComponentSet'
      },
      {
        id: 'selection.createInstance',
        label: 'Create Instance',
        command: 'selection.createInstance'
      },
      {
        id: 'selection.goToMainComponent',
        label: 'Go to Main Component',
        command: 'selection.goToMainComponent'
      },
      {
        id: 'selection.detachInstance',
        label: 'Detach Instance',
        command: 'selection.detachInstance'
      },
      { type: 'separator' },
      {
        id: 'selection.moveToPage',
        label: 'Move to Page',
        command: 'selection.moveToPage',
        target: 'browser'
      },
      {
        id: 'selection.bringForward',
        label: 'Bring Forward',
        command: 'selection.bringForward'
      },
      {
        id: 'selection.bringToFront',
        label: 'Bring to Front',
        command: 'selection.bringToFront'
      },
      {
        id: 'selection.sendBackward',
        label: 'Send Backward',
        command: 'selection.sendBackward'
      },
      {
        id: 'selection.sendToBack',
        label: 'Send to Back',
        command: 'selection.sendToBack'
      }
    ]
  },
  {
    label: 'Text',
    items: [
      { id: 'text.bold', label: 'Bold', shortcut: 'MOD+B' },
      { id: 'text.italic', label: 'Italic', shortcut: 'MOD+I' },
      { id: 'text.underline', label: 'Underline', shortcut: 'MOD+U' }
    ]
  },
  {
    label: 'Arrange',
    items: [
      {
        id: 'selection.wrapInAutoLayout',
        label: 'Wrap in Auto Layout',
        command: 'selection.wrapInAutoLayout'
      },
      { type: 'separator' },
      { id: 'arrange.align-left', label: 'Align Left', shortcut: 'ALT+A' },
      { id: 'arrange.align-center', label: 'Align Center', shortcut: 'ALT+H' },
      { id: 'arrange.align-right', label: 'Align Right', shortcut: 'ALT+D' },
      { type: 'separator' },
      { id: 'arrange.align-top', label: 'Align Top', shortcut: 'ALT+W' },
      { id: 'arrange.align-middle', label: 'Align Middle', shortcut: 'ALT+V' },
      { id: 'arrange.align-bottom', label: 'Align Bottom', shortcut: 'ALT+S' },
      { type: 'separator' },
      {
        id: 'selection.distributeHorizontal',
        label: 'Distribute Horizontal Spacing',
        command: 'selection.distributeHorizontal'
      },
      {
        id: 'selection.distributeVertical',
        label: 'Distribute Vertical Spacing',
        command: 'selection.distributeVertical'
      }
    ]
  }
] satisfies AppMenuGroupSchema[]
