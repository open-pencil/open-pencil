import type { AppMenuGroupSchema } from './types'

/** The View menu: zoom, pages, splits, overlays, theme, and panels. */
export const VIEW_MENU: AppMenuGroupSchema = {
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
    { id: 'zoom-in', feature: 'document', label: 'Zoom In', shortcut: 'Mod+=' },
    { id: 'zoom-out', feature: 'document', label: 'Zoom Out', shortcut: 'Mod+-' },
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
    // Free in Figma; beside ⌘\ (Toggle UI).
    {
      id: 'view-split-right',
      feature: 'document',
      label: 'Split Right',
      shortcut: 'Mod+Shift+\\'
    },
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
      shortcut: 'Shift+R'
    },
    // Figma's View › Pixel grid, shown once zoomed in far enough.
    {
      id: 'view-pixel-grid',
      feature: 'document',
      label: 'Pixel Grid',
      checkbox: true,
      shortcut: "Shift+'"
    },
    {
      id: 'view-multiplayer-cursors',
      feature: 'document',
      label: 'Multiplayer Cursors',
      checkbox: true,
      shortcut: 'Mod+Alt+\\'
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
      shortcut: 'Shift+C'
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
          shortcut: "Mod+Shift+'",
          handler: 'shell'
        }
      ]
    },
    { type: 'separator' },
    { id: 'toggle-ui', feature: 'document', label: 'Toggle UI', shortcut: 'Mod+\\' },
    {
      id: 'toggle-ai',
      feature: 'document',
      label: 'Toggle AI Chat',
      shortcut: 'Mod+J',
      palette: { keywords: ['assistant', 'agent', 'chat', 'prompt'] }
    },
    { id: 'toggle-preview', feature: 'document', label: 'Preview', shortcut: 'Mod+Alt+Enter' },
    { type: 'separator' },
    { id: 'profiler', label: 'Profiler', checkbox: true, target: 'browser' },
    {
      id: 'dev-tools',
      label: 'Developer Tools',
      shortcut: 'Mod+Alt+I',
      target: 'native'
    }
  ]
}
