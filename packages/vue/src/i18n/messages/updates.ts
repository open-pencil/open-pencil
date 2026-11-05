import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const updatesMessageDefaults = {
  upToDate: 'Lawha is up to date',
  windowTitle: 'Software Update',
  checking: 'Checking for updates…',
  available: params('Lawha {version} is available'),
  currentVersion: params('You have version {version}.'),
  whatsNew: 'What’s new',
  noNotes: 'This release has no release notes.',
  fullReleaseNotes: 'Full release notes',
  later: 'Later',
  install: 'Install Update',
  installAndRestart: 'Install and Restart',
  retry: 'Try Again',
  downloadProgress: params('{percent}% · {downloaded} of {total}'),
  downloadProgressUnknown: params('{downloaded} downloaded'),
  installing: 'Installing…',
  installed: params('Lawha {version} is installed'),
  restartToFinish: 'Restart Lawha to start using the new version.',
  restartNow: 'Restart Now',
  downloadFailed: params('Could not download the update: {error}'),
  installFailed: params('Could not install the update: {error}'),
  restartFailed: params('Could not restart Lawha: {error}'),
  unavailable: 'Updates are not available yet. Publish a signed release with latest.json first.',
  checkFailed: params('Could not check for updates: {error}'),
  download: 'Download'
} as const

export const updatesMessages = i18n('updates', updatesMessageDefaults)
