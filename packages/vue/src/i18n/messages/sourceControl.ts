import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const sourceControlMessageDefaults = {
  title: 'Source control',
  unavailable: 'git is not installed or not on PATH.',
  noUpstream: 'No upstream branch yet',
  aheadBehind: params('{ahead} ahead, {behind} behind'),
  changes: params('Changes: {count}'),
  fetch: 'Fetch',
  pull: 'Pull',
  stash: 'Stash changes',
  newBranch: 'New branch',
  branchName: 'Branch name',
  create: 'Create',
  backToFiles: 'All files',
  untrackedNote: 'New file: git does not track it yet.',
  gitFailed: 'git reported a problem.',
  clean: 'The working tree is clean.',
  commitMessage: 'Commit message',
  commitPlaceholder: 'feat: describe the change',
  commit: 'Commit all changes',
  push: 'Push',
  fileClean: 'No changes',
  fileModified: 'Modified',
  fileAdded: 'Added',
  fileUntracked: 'New file',
  fileDeleted: 'Deleted',
  fileRenamed: 'Renamed',
  otherChanges: params('{count} other files changed'),
  saveFirst: 'Save the document to a file, and git will see it.',
  notVersioned: 'This file is outside every git repository.',
  commitFile: 'Commit this file',
  branches: 'Branches',
  history: 'File history',
  historyRefresh: 'Refresh history',
  historyEmpty: 'No commits have touched this file yet.',
  restoreVersion: params('Restore {commit}'),
  restoreHeading: params('Restore this file to {commit}?'),
  restoreDescription: 'The file is replaced by that version; edits that are not saved go with it.',
  restoreConfirm: 'Restore',
  createPullRequest: 'Open pull request page'
} as const

export const sourceControlMessages = i18n('sourceControl', sourceControlMessageDefaults)
