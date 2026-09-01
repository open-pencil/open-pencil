import { i18n } from '#vue/i18n/create'

export const renderingMessageDefaults = {
  settingsTitle: 'Rendering',
  settingsDescription: 'Choose how OpenPencil presents large canvases.',
  progressiveTiled: 'Progressive tiled canvas rendering',
  progressiveTiledDescription:
    'Updates large canvases in bounded tiles while navigating. Experimental; reload required.',
  reloadRequired: 'Reload OpenPencil to apply this change.',
  urlOverride:
    'The current session renderer is controlled by a URL override. Your saved preference applies when the override is removed.'
} as const

export const renderingMessages = i18n('rendering', renderingMessageDefaults)
