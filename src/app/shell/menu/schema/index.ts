import type { AppMenuActionItem, AppMenuGroupSchema } from './types'

export type {
  AppMenuTarget,
  AppMenuIcon,
  AppMenuPaletteLabel,
  AppMenuPaletteMetadata,
  AppMenuHandler,
  AppMenuFeature,
  AppMenuActionItem,
  AppMenuSeparatorItem,
  AppMenuEntry,
  AppMenuGroupSchema
} from './types'

/** Settings…, where each platform expects it: the macOS application menu, otherwise File. */
const SETTINGS_MENU_ITEM = {
  id: 'settings',
  label: 'Settings…',
  shortcut: 'MOD+,',
  accelerator: 'CmdOrCtrl+,'
} satisfies AppMenuActionItem

export const APP_MENU_SCHEMA = [
  {
    label: 'File',
    paletteIcon: 'file',
    items: [
      { id: 'new', label: 'New Design', shortcut: 'MOD+N' },
      { id: 'new-tab', label: 'New Tab', shortcut: 'MOD+T' },
      { id: 'open', label: 'Open…', shortcut: 'MOD+O' },
      { id: 'open-recent', label: 'Open Recent', target: 'native' },
      { id: 'open-tour', label: 'Open the Tour', handler: 'shell' },
      {
        id: 'diagnostics',
        label: 'Diagnostics…',
        handler: 'shell',
        palette: { keywords: ['log', 'report', 'bug', 'problem', 'troubleshoot'] }
      },
      { type: 'separator' },
      { id: 'save', feature: 'document', label: 'Save', shortcut: 'MOD+S' },
      { id: 'save-as', feature: 'document', label: 'Save As…', shortcut: 'MOD+SHIFT+S' },
      { id: 'save-to', feature: 'document', label: 'Save To…' },
      {
        id: 'save-version',
        label: 'Save to Version History…',
        shortcut: 'ALT+MOD+S',
        feature: 'cloud-document'
      },
      { id: 'version-history', label: 'Show Version History', feature: 'cloud-document' },
      { type: 'separator' },
      {
        id: 'export-selection',
        feature: 'document',
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
            id: 'export-drawio',
            label: 'draw.io',
            palette: { icon: 'download', label: 'exportSelectionAsDrawIO' }
          },
          {
            id: 'export-fig',
            label: '.fig',
            palette: { icon: 'download', label: 'exportSelectionAsFig' }
          }
        ]
      },
      { type: 'separator' },
      { id: 'autosave', label: 'Autosave', checkbox: true, feature: 'local-file' },
      { id: 'close', feature: 'document', label: 'Close Tab', shortcut: 'MOD+W' },
      // ⌃Tab on every platform, as in Figma's desktop app, so it is not a MOD shortcut.
      { id: 'previous-tab', label: 'Select Previous Tab', accelerator: 'Ctrl+Shift+Tab' },
      { id: 'next-tab', label: 'Select Next Tab', accelerator: 'Ctrl+Tab' },
      // Windows, Linux, and the browser menu; macOS shows it in the application menu instead.
      { type: 'separator' },
      { ...SETTINGS_MENU_ITEM, handler: 'shell' }
    ]
  },
  {
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
      { id: 'copy', label: 'Copy', shortcut: 'MOD+C' },
      { id: 'cut', label: 'Cut', shortcut: 'MOD+X' },
      { id: 'paste', label: 'Paste', shortcut: 'MOD+V' },
      {
        id: 'paste-to-replace',
        feature: 'document',
        label: 'Paste to replace',
        shortcut: 'MOD+SHIFT+R'
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
        shortcut: 'MOD+R'
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
  },
  {
    label: 'View',
    paletteIcon: 'eye',
    items: [
      {
        id: 'view.zoom100',
        feature: 'document',
        label: 'Zoom to 100%',
        command: 'view.zoom100'
      },
      {
        id: 'view.zoomFit',
        feature: 'document',
        label: 'Zoom to Fit',
        command: 'view.zoomFit'
      },
      {
        id: 'view.zoomSelection',
        feature: 'document',
        label: 'Zoom to Selection',
        command: 'view.zoomSelection'
      },
      { id: 'zoom-in', feature: 'document', label: 'Zoom In', shortcut: 'MOD+=' },
      { id: 'zoom-out', feature: 'document', label: 'Zoom Out', shortcut: 'MOD+-' },
      { type: 'separator' },
      {
        id: 'view.zoomPreviousFrame',
        feature: 'document',
        label: 'Zoom to Previous Frame',
        command: 'view.zoomPreviousFrame'
      },
      {
        id: 'view.zoomNextFrame',
        feature: 'document',
        label: 'Zoom to Next Frame',
        command: 'view.zoomNextFrame'
      },
      {
        id: 'view.previousPage',
        feature: 'document',
        label: 'Previous Page',
        command: 'view.previousPage'
      },
      { id: 'view.nextPage', feature: 'document', label: 'Next Page', command: 'view.nextPage' },
      { type: 'separator' },
      { id: 'view-split-right', feature: 'document', label: 'Split Right' },
      { id: 'view-split-down', feature: 'document', label: 'Split Down' },
      { type: 'separator' },
      {
        id: 'variables',
        feature: 'document',
        label: 'Variables…',
        palette: {
          icon: 'variables',
          keywords: ['tokens', 'design tokens', 'css variables', 'collections', 'modes', 'theme']
        }
      },
      { type: 'separator' },
      {
        id: 'view-rulers',
        feature: 'document',
        label: 'Rulers',
        checkbox: true,
        shortcut: 'SHIFT+R'
      },
      // Figma's View › Pixel grid, shown once zoomed in far enough.
      {
        id: 'view-pixel-grid',
        feature: 'document',
        label: 'Pixel Grid',
        checkbox: true,
        shortcut: "SHIFT+'"
      },
      {
        id: 'view-multiplayer-cursors',
        feature: 'document',
        label: 'Multiplayer Cursors',
        checkbox: true,
        shortcut: 'ALT+MOD+\\'
      },
      {
        id: 'view-design-issues',
        feature: 'document',
        label: 'Design Issues',
        checkbox: true,
        handler: 'shell'
      },
      {
        id: 'view-comments',
        feature: 'document',
        label: 'Comments',
        checkbox: true,
        shortcut: 'SHIFT+C'
      },
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
            shortcut: "MOD+SHIFT+'",
            handler: 'shell'
          }
        ]
      },
      { type: 'separator' },
      { id: 'toggle-ui', feature: 'document', label: 'Toggle UI', shortcut: 'MOD+\\' },
      { id: 'toggle-preview', feature: 'document', label: 'Preview', shortcut: 'MOD+ALT+↩' },
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
    feature: 'document',
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
      { type: 'separator' },
      {
        id: 'insert-icon',
        label: 'Insert Icon…',
        palette: { keywords: ['iconify', 'symbol', 'glyph', 'lucide'] }
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
    label: 'Text',
    feature: 'document',
    paletteIcon: 'type',
    items: [
      { id: 'text.bold', label: 'Bold', shortcut: 'MOD+B' },
      { id: 'text.italic', label: 'Italic', shortcut: 'MOD+I' },
      { id: 'text.underline', label: 'Underline', shortcut: 'MOD+U' }
    ]
  },
  {
    label: 'Arrange',
    feature: 'document',
    paletteIcon: 'layers',
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
      },
      { type: 'separator' },
      { id: 'selection.tidyUp', label: 'Tidy Up', command: 'selection.tidyUp' },
      {
        id: 'selection.packHorizontal',
        label: 'Pack Horizontal',
        command: 'selection.packHorizontal'
      },
      { id: 'selection.packVertical', label: 'Pack Vertical', command: 'selection.packVertical' },
      {
        id: 'arrange-layout',
        label: 'Auto Arrange',
        sub: [
          {
            id: 'selection.arrangeSpread',
            label: 'Spread Apart',
            command: 'selection.arrangeSpread'
          },
          {
            id: 'selection.arrangeCompact',
            label: 'Spread and Compact',
            command: 'selection.arrangeCompact'
          },
          {
            id: 'selection.arrangePack',
            label: 'Pack into Rows',
            command: 'selection.arrangePack'
          },
          { type: 'separator' },
          {
            id: 'selection.arrangeFlowDown',
            label: 'Flow, Top to Bottom',
            command: 'selection.arrangeFlowDown'
          },
          {
            id: 'selection.arrangeFlowRight',
            label: 'Flow, Left to Right',
            command: 'selection.arrangeFlowRight'
          },
          {
            id: 'selection.arrangeTreeDown',
            label: 'Tree, Top to Bottom',
            command: 'selection.arrangeTreeDown'
          },
          {
            id: 'selection.arrangeTreeRight',
            label: 'Tree, Left to Right',
            command: 'selection.arrangeTreeRight'
          },
          {
            id: 'selection.arrangeRadial',
            label: 'Radial Map',
            command: 'selection.arrangeRadial'
          },
          { id: 'selection.arrangeNetwork', label: 'Network', command: 'selection.arrangeNetwork' }
        ]
      }
    ]
  }
] satisfies AppMenuGroupSchema[]

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
