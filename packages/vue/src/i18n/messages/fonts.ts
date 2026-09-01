import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const fontsMessageDefaults = {
  settingsTitle: 'Font settings',
  issueFound: '1 font face is unavailable or substituted',
  issuesFound: params('{count} font faces are unavailable or substituted'),
  selectAffectedLayers: 'Select layers',
  retry: 'Retry fonts',
  retrying: 'Retrying…',
  expandIssues: 'Show font issues',
  collapseIssues: 'Hide font issues',
  noSubstitute: 'no substitute available',
  affectedLayer: '1 affected layer',
  affectedLayerCount: params('{count} affected layers'),
  settingsDesktopDescription:
    'Access system fonts, online providers, fallback packs, and cached downloads.',
  settingsBrowserDescription:
    'Allow browser access to local fonts and manage online font providers.',
  localFonts: 'Local fonts',
  onlineFonts: 'Online fonts',
  downloadedCache: 'Downloaded cache',
  systemFontAccess: 'System font access',
  systemFontsAvailable: 'System fonts are available.',
  allowBrowserFontAccess: 'Allow browser font access when system fonts are missing.',
  onlineFontProviders: 'Online font providers',
  downloadMissingWebFonts: 'Download missing web fonts through enabled providers.',
  webFontProvidersRequireDesktopApp:
    'Online font provider catalogs are unavailable in the web app. Download the desktop app to browse and load provider fonts.',
  fallbackPacks: 'Fallback packs',
  downloadFallbackPacksDescription:
    'Download CJK and Arabic fallbacks before opening files that need them.',
  localFontAccessEnabled: 'Local font access enabled.',
  localFontAccessNotGranted: 'Local font access was not granted.',
  onlineFontProvidersEnabled: 'Online font providers enabled.',
  onlineFontProvidersDisabled: 'Online font providers disabled.',
  providerEnabled: params('Enabled {provider}.'),
  providerDisabled: params('Disabled {provider}.'),
  fallbackDownloaded: 'Fallback fonts downloaded.',
  fallbackDownloadFailed: 'Could not download fallback fonts.',
  downloadedFontCacheCleared: 'Downloaded font cache cleared.',
  downloadedFontCacheClearFailed: 'Could not clear downloaded font cache.',
  clearCache: 'Clear cache'
} as const

export const fontsMessages = i18n('fonts', fontsMessageDefaults)
