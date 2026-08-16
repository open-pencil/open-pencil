import { readFile } from 'node:fs/promises'

import type { Heading, RootContent } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'

function headingText(node: Heading): string {
  return node.children
    .map((child) => ('value' in child && typeof child.value === 'string' ? child.value : ''))
    .join('')
    .trim()
}

function headingOffset(node: RootContent, edge: 'start' | 'end'): number {
  const offset = node.position?.[edge].offset
  if (offset === undefined) throw new Error('Changelog heading is missing source position data')
  return offset
}

export function releaseNotesFromChangelog(markdown: string, version: string): string {
  const tree = fromMarkdown(markdown)
  const versionPrefix = `${version} `
  const headingIndex = tree.children.findIndex(
    (node) =>
      node.type === 'heading' &&
      node.depth === 2 &&
      (headingText(node) === version || headingText(node).startsWith(versionPrefix))
  )
  if (headingIndex === -1) throw new Error(`Changelog section not found for ${version}`)

  const heading = tree.children[headingIndex]
  if (!heading || heading.type !== 'heading')
    throw new Error(`Invalid changelog section for ${version}`)
  const nextHeading = tree.children
    .slice(headingIndex + 1)
    .find((node) => node.type === 'heading' && node.depth === 2)
  const start = headingOffset(heading, 'end')
  const end = nextHeading ? headingOffset(nextHeading, 'start') : markdown.length
  const notes = markdown.slice(start, end).trim()
  if (!notes) throw new Error(`Changelog section is empty for ${version}`)
  return `${notes}\n`
}

export async function readReleaseNotes(path: string, version: string): Promise<string> {
  return releaseNotesFromChangelog(await readFile(path, 'utf8'), version)
}
