import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import { headingText, sectionEnd } from './changelog/validate.ts'
import { RELEASE_NOTES_LIMIT } from './release-notes-limit.ts'

/**
 * The changelog a release's notes come from: the one in this tooling's checkout, at the workflow's
 * commit. A tag's own build runs the tag's tooling, so that is the tag's changelog; a recovery
 * dispatched from the default branch reads the section as that branch has it now.
 */
export async function releaseChangelogPath(): Promise<string> {
  return join(await resolveWorkspaceRoot(import.meta.dirname), 'CHANGELOG.md')
}

/**
 * The changelog section for `version`, as written: everything between its `## x.y.z — date`
 * heading and the next release's, Markdown and HTML comments in code spans included, which a
 * changelog parser that renders the section would strip.
 */
export async function readReleaseNotes(path: string, version: string): Promise<string> {
  const source = await readFile(path, 'utf8')
  const children = (fromMarkdown(source) as Root).children
  const index = children.findIndex(
    (node) =>
      node.type === 'heading' &&
      node.depth === 2 &&
      headingText(node).split(' — ')[0]?.trim() === version
  )
  if (index === -1) throw new Error(`Changelog section not found for ${version}`)
  const start = children[index]?.position?.end.offset
  const end = children[sectionEnd(children, index)]?.position?.start.offset
  const notes = source.slice(start, end).trim()
  if (!notes) throw new Error(`Changelog section is empty for ${version}`)
  if (notes.length >= RELEASE_NOTES_LIMIT) {
    throw new Error(
      `Changelog section for ${version} is ${notes.length} characters; a GitHub release takes ${RELEASE_NOTES_LIMIT}`
    )
  }
  return `${notes}\n`
}
