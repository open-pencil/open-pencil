import { readFile } from 'node:fs/promises'

import type { Heading, List, ListItem, Root, RootContent } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'

const ALLOWED_CATEGORIES = [
  'Breaking changes',
  'Added',
  'Changed',
  'Fixed',
  'Performance',
  'Security'
] as const

const CATEGORY_INDEX = new Map(ALLOWED_CATEGORIES.map((category, index) => [category, index]))
const RELEASE_HEADING = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)? — (\d{4}-\d{2}-\d{2})$/

export interface ChangelogValidationResult {
  errors: string[]
}

interface PositionedNode {
  position?: { start: { line: number } }
}

function headingText(heading: Heading): string {
  return heading.children
    .map((child) => ('value' in child && typeof child.value === 'string' ? child.value : ''))
    .join('')
    .trim()
}

function line(node: PositionedNode): number {
  return node.position?.start.line ?? 0
}

function listItemSource(source: string, item: ListItem): string {
  const start = item.position?.start.offset
  const end = item.position?.end.offset
  if (start === undefined || end === undefined) return ''
  return source.slice(start, end).trim().replace(/\s+/g, ' ')
}

function sectionEnd(children: RootContent[], start: number): number {
  for (let index = start + 1; index < children.length; index++) {
    const node = children[index]
    if (node?.type === 'heading' && node.depth === 2) return index
  }
  return children.length
}

function categoryHasItems(children: RootContent[], start: number, end: number): boolean {
  for (let index = start + 1; index < end; index++) {
    const node = children[index]
    if (node?.type === 'heading' && node.depth <= 3) break
    if (node?.type === 'list' && !node.ordered && node.children.length > 0) return true
  }
  return false
}

function isValidDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

function validateReleaseHeading(heading: Heading, errors: string[]): void {
  const text = headingText(heading)
  if (text === 'Unreleased') return
  const match = RELEASE_HEADING.exec(text)
  if (!match) {
    errors.push(
      `Line ${line(heading)}: invalid release heading "${text}"; expected "## x.y.z — YYYY-MM-DD".`
    )
    return
  }
  const date = match[1]
  if (date && !isValidDate(date)) {
    errors.push(`Line ${line(heading)}: invalid release date "${date}".`)
  }
}

function validateUnreleased(
  source: string,
  children: RootContent[],
  start: number,
  end: number,
  errors: string[]
): void {
  const seenCategories = new Set<string>()
  const seenBullets = new Map<string, number>()
  let currentCategory: string | null = null
  let previousCategoryIndex = -1

  for (let index = start + 1; index < end; index++) {
    const node = children[index]
    if (!node) continue

    if (node.type === 'heading') {
      if (node.depth !== 3) {
        errors.push(
          `Line ${line(node)}: Unreleased content may only use level-three category headings.`
        )
        continue
      }

      const category = headingText(node)
      const categoryIndex = CATEGORY_INDEX.get(category as (typeof ALLOWED_CATEGORIES)[number])
      if (categoryIndex === undefined) {
        currentCategory = null
        errors.push(
          `Line ${line(node)}: unsupported Unreleased category "${category}"; use ${ALLOWED_CATEGORIES.join(', ')}.`
        )
        continue
      }
      if (seenCategories.has(category)) {
        errors.push(`Line ${line(node)}: duplicate Unreleased category "${category}".`)
      }
      if (categoryIndex < previousCategoryIndex) {
        errors.push(`Line ${line(node)}: Unreleased category "${category}" is out of order.`)
      }
      if (!categoryHasItems(children, index, end)) {
        errors.push(`Line ${line(node)}: Unreleased category "${category}" is empty.`)
      }
      seenCategories.add(category)
      currentCategory = category
      previousCategoryIndex = Math.max(previousCategoryIndex, categoryIndex)
      continue
    }

    if (node.type === 'list' && !node.ordered) {
      if (currentCategory === null) {
        errors.push(
          `Line ${line(node)}: Unreleased bullets must follow an allowed category heading.`
        )
      }
      const list = node as List
      for (const item of list.children) {
        const bullet = listItemSource(source, item)
        if (!bullet) continue
        const firstLine = seenBullets.get(bullet)
        if (firstLine !== undefined) {
          errors.push(
            `Line ${line(item)}: duplicate Unreleased bullet (first seen on line ${firstLine}).`
          )
        } else {
          seenBullets.set(bullet, line(item))
        }
      }
      continue
    }

    errors.push(`Line ${line(node)}: unexpected content in Unreleased.`)
  }
}

export function validateChangelog(source: string): ChangelogValidationResult {
  const tree = fromMarkdown(source) as Root
  const errors: string[] = []
  const releaseHeadings: Array<{ index: number; node: Heading }> = []
  for (const [index, node] of tree.children.entries()) {
    if (node.type === 'heading' && node.depth === 2) releaseHeadings.push({ index, node })
  }

  const unreleased = releaseHeadings.filter(({ node }) => headingText(node) === 'Unreleased')
  if (unreleased.length !== 1) {
    errors.push(`Expected exactly one "## Unreleased" section; found ${unreleased.length}.`)
  }

  for (const { node } of releaseHeadings) validateReleaseHeading(node, errors)

  const current = unreleased[0]
  if (current) {
    validateUnreleased(
      source,
      tree.children,
      current.index,
      sectionEnd(tree.children, current.index),
      errors
    )
  }

  return { errors }
}

export async function validateChangelogFile(path: string): Promise<ChangelogValidationResult> {
  return validateChangelog(await readFile(path, 'utf8'))
}
