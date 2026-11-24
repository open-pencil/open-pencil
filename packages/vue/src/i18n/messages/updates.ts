import { params } from '@nanostores/i18n'

export const updatesMessageDefaults = {
  upToDate: 'OpenPencil is up to date',
  windowTitle: 'Software Update',
  checking: 'Checking for updates…',
  available: params('OpenPencil {version} is available'),
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
  installed: params('OpenPencil {version} is installed'),
  restartToFinish: 'Restart OpenPencil to start using the new version.',
  restartNow: 'Restart Now',
  downloadFailed: params('Could not download the update: {error}'),
  installFailed: params('Could not install the update: {error}'),
  restartFailed: params('Could not restart OpenPencil: {error}'),
  unavailable: 'Updates are not available yet. Publish a signed release with latest.json first.',
  checkFailed: params('Could not check for updates: {error}'),
  webUpdateReady: 'A new version of OpenPencil is ready',
  reload: 'Reload',
  settingsSection: 'Updates',
  checkOnStartup: 'Check for updates on startup',
  checkOnStartupDescription:
    'Looks for a new version shortly after the desktop app opens. Check for Updates in the menu still runs when this is off.',
  channel: 'Update channel',
  channelDescription:
    'Nightly builds come from the newest code every night and can break. Switching back to Stable installs the current stable release at the next check.',
  channelStable: 'Stable',
  channelNightly: 'Nightly'
} as const
