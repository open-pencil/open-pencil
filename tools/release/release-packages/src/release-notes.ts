import { join } from 'node:path'

import { parseChangelog } from 'changelog-parser'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

/** GitHub refuses a release whose notes are longer, in characters. */
export const RELEASE_NOTES_LIMIT = 125_000

/**
 * The changelog a release's notes come from: the one in this tooling's checkout, at the workflow's
 * commit. A tag's own build runs the tag's tooling, so that is the tag's changelog; a recovery
 * dispatched from the default branch reads the section as that branch has it now.
 */
export async function releaseChangelogPath(): Promise<string> {
  return join(await resolveWorkspaceRoot(import.meta.dirname), 'CHANGELOG.md')
}

export async function readReleaseNotes(path: string, version: string): Promise<string> {
  const changelog = await parseChangelog({ filePath: path, removeMarkdown: false })
  const release = changelog.versions.find((entry) => entry.version === version)
  if (!release) throw new Error(`Changelog section not found for ${version}`)

  const notes = release.body.trim()
  if (!notes) throw new Error(`Changelog section is empty for ${version}`)
  if (notes.length >= RELEASE_NOTES_LIMIT) {
    throw new Error(
      `Changelog section for ${version} is ${notes.length} characters; a GitHub release takes ${RELEASE_NOTES_LIMIT}`
    )
  }
  return `${notes}\n`
}
