import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const projectsMessageDefaults = {
  title: 'Projects',
  description: 'Repositories you add here keep their own branch and changes.',
  add: 'Add project',
  empty: 'No projects yet',
  emptyDescription: 'Add the folder of a repository to open it as a project.',
  remove: params('Remove {name}'),
  rename: params('Rename {name}'),
  renameSave: 'Save name',
  renameCancel: 'Cancel renaming',
  removeConfirmation: params('Remove {name}?'),
  removeDescription: 'The repository stays on disk; the project only leaves this list.',
  removeConfirm: 'Remove',
  changes: params('{count} changed'),
  startCommand: params('Starts with {command}'),
  application: 'Application',
  runStart: 'Start',
  runStop: 'Stop',
  runOpen: 'Open',
  runStarting: 'Starting…',
  runRunning: 'Running',
  runStopped: 'Stopped',
  runExited: params('Exited with code {code}'),
  runFailed: 'The application could not start.',
  runNoCommand: 'This project has no start command.',
  runOutput: 'Application output',
  preview: 'Preview',
  previewReload: 'Reload preview',
  previewEmpty: 'Start the application to see it here.',
  addFailed: 'The project could not be added.',
  notRepository: 'That folder is not inside a git repository.',
  unavailable: 'git is not installed or not on PATH.'
} as const

export const projectsMessages = i18n('projects', projectsMessageDefaults)
