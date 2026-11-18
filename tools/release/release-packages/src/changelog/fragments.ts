import { readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

import type { List, ListItem, Root, RootContent } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'

import { appendAll } from '@open-pencil/scene-graph/arrays'

import { ALLOWED_CATEGORIES, headingText, sectionEnd } from './validate'

type Category = (typeof ALLOWED_CATEGORIES)[number]

/** Fragment file names, `changes/<PR>/<file>.md`, and the changelog heading each one fills. */
export const FRAGMENT_CATEGORIES = {
  breaking: 'Breaking changes',
  added: 'Added',
  changed: 'Changed',
  fixed: 'Fixed',
  performance: 'Performance',
  security: 'Security'
} as const satisfies Record<string, Category>

export type FragmentCategory = keyof typeof FRAGMENT_CATEGORIES

export interface ChangeFragment {
  pullRequest: number
  category: FragmentCategory
  /** Each bullet's Markdown, starting with `- `, as it will appear in the changelog. */
  bullets: string[]
}

export interface FragmentReadResult {
  fragments: ChangeFragment[]
  errors: string[]
}

const isFragmentCategory = (name: string): name is FragmentCategory =>
  Object.hasOwn(FRAGMENT_CATEGORIES, name)

/** The bullets of one fragment file: one unordered list, each item a sentence ending in a period. */
export function parseFragmentBullets(
  source: string,
  path: string
): { bullets: string[]; errors: string[] } {
  const tree = fromMarkdown(source) as Root
  const errors: string[] = []
  const lists = tree.children.filter((node): node is List => node.type === 'list' && !node.ordered)
  if (lists.length !== 1 || tree.children.length !== 1) {
    errors.push(`${path}: a fragment holds exactly one bulleted list and nothing else.`)
    return { bullets: [], errors }
  }
  const bullets = lists[0].children.map((item) => listItemMarkdown(source, item))
  for (const bullet of bullets) {
    if (!bullet.endsWith('.')) errors.push(`${path}: end every bullet with a period: ${bullet}`)
  }
  return { bullets, errors }
}

/** Reads every `changes/<PR>/<category>.md`; anything else under `changes/` is reported. */
export async function readFragments(directory: string): Promise<FragmentReadResult> {
  const fragments: ChangeFragment[] = []
  const errors: string[] = []
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: unknown) => {
    // No `changes/` folder means nothing is pending; any other failure must not pass as that.
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
    throw error
  })
  for (const entry of entries) {
    if (entry.isFile() && entry.name === 'README.md') continue
    if (!entry.isDirectory() || !/^[1-9]\d*$/.test(entry.name)) {
      errors.push(`changes/${entry.name}: expected a folder named after its pull request number.`)
      continue
    }
    const pullRequest = Number(entry.name)
    for (const file of await readdir(join(directory, entry.name), { withFileTypes: true })) {
      const path = `changes/${entry.name}/${file.name}`
      const category = file.name.replace(/\.md$/, '')
      if (!file.isFile() || !file.name.endsWith('.md') || !isFragmentCategory(category)) {
        errors.push(
          `${path}: expected one of ${Object.keys(FRAGMENT_CATEGORIES)
            .map((name) => `${name}.md`)
            .join(', ')}.`
        )
        continue
      }
      const parsed = parseFragmentBullets(
        await readFile(join(directory, entry.name, file.name), 'utf8'),
        path
      )
      appendAll(errors, parsed.errors)
      if (parsed.bullets.length > 0)
        fragments.push({ pullRequest, category, bullets: parsed.bullets })
    }
  }
  fragments.sort((a, b) => a.pullRequest - b.pullRequest)
  // Directory listings come in no fixed order; sorted errors read the same on every machine.
  return { fragments, errors: errors.toSorted() }
}

function listItemMarkdown(source: string, item: ListItem): string {
  return source.slice(item.position?.start.offset ?? 0, item.position?.end.offset ?? 0).trimEnd()
}

/**
 * The bullets `## Unreleased` already holds, by category. Anything assembly could not carry
 * over, such as prose or a list outside a category, is refused rather than dropped.
 */
function unreleasedBullets(changelog: string, nodes: RootContent[]): Map<Category, string[]> {
  const bullets = new Map<Category, string[]>(ALLOWED_CATEGORIES.map((category) => [category, []]))
  let current: Category | undefined
  for (const node of nodes) {
    const at = `CHANGELOG.md line ${node.position?.start.line ?? '?'}`
    if (node.type === 'heading') {
      const text = headingText(node)
      current = ALLOWED_CATEGORIES.find((category) => category === text)
      if (node.depth !== 3 || !current) {
        throw new Error(`${at}: "${text}" is not an Unreleased category.`)
      }
    } else if (node.type === 'list' && !node.ordered && current) {
      const list = bullets.get(current)
      if (list)
        appendAll(
          list,
          node.children.map((item) => listItemMarkdown(changelog, item))
        )
    } else {
      throw new Error(`${at}: Unreleased holds content outside a category bullet list.`)
    }
  }
  return bullets
}

function renderUnreleased(bullets: Map<Category, string[]>): string {
  const sections = ALLOWED_CATEGORIES.flatMap((category) => {
    const items = bullets.get(category) ?? []
    return items.length > 0 ? [`### ${category}\n\n${items.join('\n')}\n`] : []
  })
  return ['## Unreleased\n', ...sections].join('\n')
}

/**
 * The changelog with every fragment's bullets added under `## Unreleased`, after the bullets it
 * already holds, in category order and by pull request within a category.
 */
export function assembleUnreleased(changelog: string, fragments: ChangeFragment[]): string {
  const tree = fromMarkdown(changelog) as Root
  const headingIndex = tree.children.findIndex(
    (node) => node.type === 'heading' && node.depth === 2 && headingText(node) === 'Unreleased'
  )
  if (headingIndex === -1) throw new Error('CHANGELOG.md has no "## Unreleased" section.')
  const end = sectionEnd(tree.children, headingIndex)

  const bullets = unreleasedBullets(changelog, tree.children.slice(headingIndex + 1, end))
  for (const fragment of fragments) {
    const list = bullets.get(FRAGMENT_CATEGORIES[fragment.category])
    if (list) appendAll(list, fragment.bullets)
  }

  const sectionStart = tree.children[headingIndex].position?.start.offset ?? 0
  const sectionStop = tree.children[end]?.position?.start.offset ?? changelog.length
  const after = changelog.slice(sectionStop)
  return `${changelog.slice(0, sectionStart)}${renderUnreleased(bullets)}${after ? `\n${after}` : ''}`
}

/** Removes the assembled fragment folders, keeping `changes/README.md`. */
export async function removeFragments(
  directory: string,
  fragments: ChangeFragment[]
): Promise<void> {
  const folders = new Set(fragments.map((fragment) => String(fragment.pullRequest)))
  await Promise.all(
    [...folders].map((folder) => rm(join(directory, folder), { recursive: true, force: true }))
  )
}
