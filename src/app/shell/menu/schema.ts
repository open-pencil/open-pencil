import type { EditorCommandId } from '@open-pencil/vue'

export type AppMenuTarget = 'all' | 'browser' | 'native'

export type AppMenuIcon =
  | 'download'
  | 'eye'
  | 'file'
  | 'folder-open'
  | 'help'
  | 'layers'
  | 'pen-tool'
  | 'pencil'
  | 'redo'
  | 'save'
  | 'settings'
  | 'type'
  | 'variables'
  | 'undo'
  | 'zoom-in'
  | 'zoom-out'

export type AppMenuPaletteLabel =
  | 'exportSelectionAsPNG'
  | 'exportSelectionAsSVG'
  | 'exportSelectionAsPPTX'
  | 'exportSelectionAsFig'

export interface AppMenuPaletteMetadata {
  icon?: AppMenuIcon
  label?: AppMenuPaletteLabel
  description?: string
  keywords?: string[]
}

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
  palette?: AppMenuPaletteMetadata
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
  paletteIcon?: AppMenuIcon
  items: AppMenuEntry[]
}

/** Settings…, where each platform expects it: the macOS application menu, otherwise File. */
const SETTINGS_MENU_ITEM = {
  id: 'settings',
  label: 'Settings…',
  shortcut: 'MOD+,',
  accelerator: 'CmdOrCtrl+,'
} satisfies AppMenuActionItem

/** How the app looks and behaves while editing: Figma's Preferences, theme included. */
const PREFERENCES_MENU_ITEM = {
  id: 'preferences',
  label: 'Preferences',
  sub: [
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
    { id: 'snap-geometry', label: 'Snap to Geometry', checkbox: true, handler: 'shell' },
    { id: 'snap-objects', label: 'Snap to Objects', checkbox: true, handler: 'shell' },
    {
      id: 'snap-pixel-grid',
      label: 'Snap to Pixel Grid',
      checkbox: true,
      shortcut: "MOD+SHIFT+'",
      handler: 'shell'
    }
  ]
} satisfies AppMenuActionItem

export const APP_MENU_SCHEMA = [
  {
    label: 'File',
    paletteIcon: 'file',
    items: [
      { id: 'new', label: 'New', shortcut: 'MOD+N' },
      { id: 'open', label: 'Open…', shortcut: 'MOD+O' },
      { id: 'open-recent', label: 'Open Recent', target: 'native' },
      { id: 'open-storage-workspace', label: 'Open Storage Workspace…', handler: 'shell' },
      { type: 'separator' },
      // Figma's File › Place image: bringing outside content into the file.
      {
        id: 'insert-icon',
        label: 'Insert Icon…',
        palette: { keywords: ['iconify', 'symbol', 'glyph', 'lucide'] }
      },
      { type: 'separator' },
      { id: 'save', label: 'Save', shortcut: 'MOD+S' },
      { id: 'save-as', label: 'Save As…', shortcut: 'MOD+SHIFT+S' },
      { id: 'save-to-storage', label: 'Save to Storage…' },
      { type: 'separator' },
      {
        id: 'export-selection',
        label: 'Export Selection',
        palette: { icon: 'download' },
        shortcut: 'MOD+SHIFT+E',
        sub: [
          {
            id: 'export-png',
            label: 'PNG',
            palette: { icon: 'download', label: 'exportSelectionAsPNG' }
          },
          {
            id: 'export-svg',
            label: 'SVG',
            palette: { icon: 'download', label: 'exportSelectionAsSVG' }
          },
          {
            id: 'export-pptx',
            label: 'PPTX',
            palette: { icon: 'download', label: 'exportSelectionAsPPTX' }
          },
          {
            id: 'export-fig',
            label: '.fig',
            palette: { icon: 'download', label: 'exportSelectionAsFig' }
          }
        ]
      },
      { type: 'separator' },
      { id: 'autosave', label: 'Autosave', checkbox: true },
      { id: 'close', label: 'Close Tab', shortcut: 'MOD+W' },
      // The native File menu; the browser shows both in its main menu, and macOS shows
      // Settings… in the application menu instead.
      { type: 'separator', target: 'native' },
      { ...PREFERENCES_MENU_ITEM, target: 'native' },
      { ...SETTINGS_MENU_ITEM, handler: 'shell', target: 'native' }
    ]
  },
  {
    label: 'Edit',
    paletteIcon: 'pencil',
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
      { id: 'paste-to-replace', label: 'Paste to Replace', shortcut: 'MOD+SHIFT+R' },
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
    paletteIcon: 'eye',
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
      {
        id: 'view.zoomPreviousFrame',
        label: 'Zoom to Previous Frame',
        command: 'view.zoomPreviousFrame'
      },
      { id: 'view.zoomNextFrame', label: 'Zoom to Next Frame', command: 'view.zoomNextFrame' },
      { id: 'view.previousPage', label: 'Previous Page', command: 'view.previousPage' },
      { id: 'view.nextPage', label: 'Next Page', command: 'view.nextPage' },
      { type: 'separator' },
      { id: 'view-split-right', label: 'Split Right' },
      { id: 'view-split-down', label: 'Split Down' },
      { type: 'separator' },
      {
        id: 'variables',
        label: 'Variables…',
        palette: {
          icon: 'variables',
          keywords: ['tokens', 'design tokens', 'css variables', 'collections', 'modes', 'theme']
        }
      },
      { type: 'separator' },
      { id: 'view-rulers', label: 'Rulers', checkbox: true, shortcut: 'SHIFT+R' },
      // Figma's View › Pixel grid, shown once zoomed in far enough.
      { id: 'view-pixel-grid', label: 'Pixel Grid', checkbox: true, shortcut: "SHIFT+'" },
      {
        id: 'view-multiplayer-cursors',
        label: 'Multiplayer Cursors',
        checkbox: true,
        shortcut: 'ALT+MOD+\\'
      },
      { id: 'view-design-issues', label: 'Design Issues', checkbox: true, handler: 'shell' },
      { id: 'view-comments', label: 'Comments', checkbox: true, shortcut: 'SHIFT+C' },
      { type: 'separator' },
      { id: 'toggle-ui', label: 'Toggle UI', shortcut: 'MOD+\\' },
      { id: 'toggle-preview', label: 'Preview', shortcut: 'MOD+ALT+↩' }
    ]
  },
  {
    label: 'Object',
    paletteIcon: 'layers',
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
      // Figma's Object › Add auto layout.
      {
        id: 'selection.wrapInAutoLayout',
        label: 'Wrap in Auto Layout',
        command: 'selection.wrapInAutoLayout'
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
      // Figma's Object › Boolean groups.
      {
        id: 'boolean-operations',
        label: 'Boolean Operations',
        sub: [
          {
            id: 'selection.booleanUnion',
            label: 'Union Selection',
            command: 'selection.booleanUnion'
          },
          {
            id: 'selection.booleanSubtract',
            label: 'Subtract Selection',
            command: 'selection.booleanSubtract'
          },
          {
            id: 'selection.booleanIntersect',
            label: 'Intersect Selection',
            command: 'selection.booleanIntersect'
          },
          {
            id: 'selection.booleanExclude',
            label: 'Exclude Selection',
            command: 'selection.booleanExclude'
          }
        ]
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
        id: 'selection.createSlot',
        label: 'Create Slot',
        command: 'selection.createSlot'
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
      {
        id: 'selection.detachIcon',
        label: 'Detach Icon',
        command: 'selection.detachIcon'
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
    label: 'Vector',
    paletteIcon: 'pen-tool',
    items: [
      {
        id: 'selection.flatten',
        label: 'Flatten',
        command: 'selection.flatten'
      },
      {
        id: 'selection.outlineStroke',
        label: 'Outline Stroke',
        command: 'selection.outlineStroke'
      },
      {
        id: 'selection.outlineText',
        label: 'Outline Text',
        command: 'selection.outlineText'
      }
    ]
  },
  {
    label: 'Text',
    paletteIcon: 'type',
    items: [
      { id: 'text.bold', label: 'Bold', shortcut: 'MOD+B' },
      { id: 'text.italic', label: 'Italic', shortcut: 'MOD+I' },
      { id: 'text.underline', label: 'Underline', shortcut: 'MOD+U' }
    ]
  },
  {
    label: 'Arrange',
    paletteIcon: 'layers',
    items: [
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
  },
  {
    label: 'Help',
    paletteIcon: 'help',
    items: [
      // The welcome doubles as the About screen: what OpenPencil is, the tour, and AI setup.
      { id: 'show-welcome', label: 'Show Welcome', handler: 'shell' },
      { type: 'separator' },
      { id: 'help-docs', label: 'Documentation', handler: 'shell' },
      { id: 'help-whats-new', label: "What's New", handler: 'shell' },
      { id: 'help-report-issue', label: 'Report an Issue', handler: 'shell' },
      { id: 'help-desktop-app', label: 'Get the Desktop App', target: 'browser' },
      // Windows and Linux; macOS shows it in the application menu instead.
      { type: 'separator' },
      { id: 'check-updates', label: 'Check for Updates…', target: 'native', handler: 'shell' },
      {
        id: 'developer',
        label: 'Developer',
        sub: [
          { id: 'profiler', label: 'Profiler', checkbox: true, target: 'browser' },
          {
            id: 'dev-tools',
            label: 'Developer Tools',
            accelerator: 'CmdOrCtrl+Alt+I',
            target: 'native'
          }
        ]
      }
    ]
  }
] satisfies AppMenuGroupSchema[]

/**
 * The browser's main menu, opened from the logo, follows Figma's: leaving the file and searching
 * actions first, then the schema's menus, then preferences, with Help last. The desktop app
 * shows the schema's menus in the native menu bar instead.
 */
export const MAIN_MENU_LEADING_ITEMS = [
  { id: 'back-to-files', label: 'Back to Files' },
  { id: 'actions', label: 'Actions…', shortcut: 'MOD+K' }
] satisfies AppMenuActionItem[]

export const MAIN_MENU_TRAILING_ITEMS = [
  PREFERENCES_MENU_ITEM,
  SETTINGS_MENU_ITEM
] satisfies AppMenuActionItem[]

/**
 * Custom entries in the macOS application menu.
 *
 * Placement stays in Rust because the OS-predefined items (About, Services, Hide)
 * sit between them. Only the labels and accelerators are shared here.
 */
export const APP_MENU_APP_ITEMS = [
  { id: 'about', label: 'About OpenPencil' },
  { id: 'check-updates', label: 'Check for Updates…' },
  SETTINGS_MENU_ITEM,
  { id: 'quit', label: 'Quit OpenPencil', shortcut: 'MOD+Q' }
] satisfies AppMenuActionItem[]
