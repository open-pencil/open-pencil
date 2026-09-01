import { i18n } from '#vue/i18n/create'

export const settingsMessageDefaults = {
  title: 'Settings',
  description: 'Manage integrations and app preferences.',
  general: 'General',
  languageDescription: 'Choose the language used by the app interface.',
  editing: 'Editing',
  snappingDescription: 'Control alignment while editing paths, moving, and resizing layers.',
  snapToGeometry: 'Snap to geometry',
  snapToGeometryDescription: 'Align dragged vector points to other points in the path.',
  snapToObjects: 'Snap to objects',
  snapToObjectsDescription:
    'Align vector points and layer bounds to nearby layer edges and centers.',
  snapToPixelGrid: 'Snap to pixel grid',
  snapToPixelGridDescription:
    'Align vector points, moved layers, and resized edges to whole pixels.',
  temporaryDisableSnappingHint: 'Hold Control while dragging to temporarily disable snapping.',
  aiAndAgents: 'AI & agents',
  usage: 'Usage',
  diagnostics: 'Diagnostics',
  media: 'Media',
  automation: 'MCP & automation',
  storage: 'Cloud storage',
  mobilePanelNavigation: 'Mobile panel navigation',
  notifications: 'Notifications'
} as const

export const settingsMessages = i18n('settings', settingsMessageDefaults)
