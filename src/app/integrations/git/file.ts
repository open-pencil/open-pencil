import * as v from 'valibot'

import { gitCommitSummarySchema, type GitCommitSummary, type GitFileState } from './schema'

/** The field separator git writes between a commit's fields for `LOG_FORMAT`. */
const FIELD_SEPARATOR = '\u001f'

/** The `log --format` whose lines `parseFileHistory` reads back. */
export const LOG_FORMAT = '%H%x1f%an%x1f%aI%x1f%s'

/**
 * The porcelain v1 status of a single path: `XY` letters for tracked files, `??` for a file git
 * has never seen. One path can answer with several records, a rename taking two, so the first
 * one decides how the file stands.
 */
export function parseFileState(stdout: string): GitFileState {
  const record = stdout.split('\0').find((entry) => entry !== '') ?? ''
  const letters = record.slice(0, 2)
  if (letters === '') return 'clean'
  if (letters === '??') return 'untracked'
  if (letters.includes('D')) return 'deleted'
  if (letters.includes('R')) return 'renamed'
  if (letters.includes('A')) return 'added'
  return 'modified'
}

/**
 * Commits that touched a file, newest first. A repository with no commits yet answers nothing
 * rather than a failure, since a file cannot have history there.
 */
export function parseFileHistory(stdout: string): GitCommitSummary[] {
  return stdout
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
    .map((line) => {
      const [hash = '', author = '', date = '', subject = ''] = line.split(FIELD_SEPARATOR)
      return v.parse(gitCommitSummarySchema, { hash, author, date, subject })
    })
}
