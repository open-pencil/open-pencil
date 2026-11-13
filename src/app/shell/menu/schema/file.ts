import type { AppMenuActionItem, AppMenuGroupSchema } from './types'

/** Settings…, where each platform expects it: the macOS application menu, otherwise File. */
export const SETTINGS_MENU_ITEM = {
  id: 'settings',
  label: 'Settings…',
  shortcut: 'Mod+,'
} satisfies AppMenuActionItem

/** The File menu: documents, tabs, saving, export, and Settings outside macOS. */
export const FILE_MENU: AppMenuGroupSchema = {
  label: 'File',
  paletteIcon: 'file',
  items: [
    { id: 'new', label: 'New Design', shortcut: 'Mod+N' },
    { id: 'new-board', label: 'New Board' },
    { id: 'new-tab', label: 'New Tab', shortcut: 'Mod+T' },
    { id: 'open', label: 'Open…', shortcut: 'Mod+O' },
    { id: 'open-recent', label: 'Open Recent', target: 'native' },
    { type: 'separator' },
    { id: 'save', feature: 'document', label: 'Save', shortcut: 'Mod+S' },
    { id: 'save-as', feature: 'document', label: 'Save As…', shortcut: 'Mod+Shift+S' },
    { id: 'save-to', feature: 'document', label: 'Save To…' },
    {
      id: 'save-version',
      label: 'Save to Version History…',
      shortcut: 'Mod+Alt+S',
      feature: 'cloud-document'
    },
    { id: 'version-history', label: 'Show Version History', feature: 'cloud-document' },
    { type: 'separator' },
    {
      id: 'export-selection',
      feature: 'document',
      label: 'Export Selection',
      palette: { icon: 'download' },
      shortcut: 'Mod+Shift+E',
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
    { id: 'close', feature: 'document', label: 'Close Tab', shortcut: 'Mod+W' },
    // ⌃Tab on every platform, as in Figma's desktop app, so it is not a MOD shortcut.
    { id: 'previous-tab', label: 'Select Previous Tab', shortcut: 'Control+Shift+Tab' },
    { id: 'next-tab', label: 'Select Next Tab', shortcut: 'Control+Tab' },
    // Windows, Linux, and the browser menu; macOS shows it in the application menu instead.
    { type: 'separator' },
    { ...SETTINGS_MENU_ITEM, handler: 'shell' }
  ]
}
