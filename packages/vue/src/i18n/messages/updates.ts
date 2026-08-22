import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const updatesMessageDefaults = {
  appUpToDate: 'OpenPencil is up to date',
  updateAvailableTitle: 'Update OpenPencil',
  updateAvailable: params('OpenPencil {version} is available.'),
  updateInstallPrompt:
    'Download and install it now? The app will restart after the update is installed.',
  downloadingUpdate: params('Downloading OpenPencil {version}'),
  updateInstalledTitle: 'Update installed',
  updateInstalled: params('OpenPencil {version} was installed{size}. Restarting now.'),
  updateUnavailable:
    'Updates are not available yet. Publish a signed release with latest.json first.',
  updateCheckFailed: params('Could not check for updates: {error}')
} as const

export const updatesMessages = i18n('updates', updatesMessageDefaults)
