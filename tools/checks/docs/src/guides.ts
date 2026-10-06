import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export interface GuideMapOptions {
  repoRoot: string
  /** Directory names that are never scanned for guides; hidden directories are always skipped. */
  ignoredDirectories?: readonly string[]
}

export interface GuideMapResult {
  errors: string[]
  /** Nested guides found on disk, repo-relative with `/` separators, sorted. */
  guides: string[]
  /** Guide paths referenced from the root `AGENTS.md`, sorted. */
  listed: string[]
}

export const ROOT_GUIDE = 'AGENTS.md'
const DEFAULT_IGNORED_DIRECTORIES = ['dist', 'node_modules', 'scratch', 'target']
const GUIDE_REFERENCE = /`((?:[\w.-]+\/)+AGENTS\.md)`/g

function walkGuides(directory: string, repoRoot: string, ignored: ReadonlySet<string>): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || ignored.has(entry.name)) return []
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return walkGuides(path, repoRoot, ignored)
    if (!entry.isFile() || entry.name !== ROOT_GUIDE) return []
    const rel = relative(repoRoot, path).split(sep).join('/')
    return rel === ROOT_GUIDE ? [] : [rel]
  })
}

/** Guide paths written as inline code in Markdown, for example `packages/core/AGENTS.md`. */
export function listedGuides(markdown: string): string[] {
  const found = new Set<string>()
  for (const match of markdown.matchAll(GUIDE_REFERENCE)) found.add(match[1])
  return [...found].sort()
}

/**
 * Every nested `AGENTS.md` must be reachable from the root guide's map, and every guide the root
 * mentions must exist, so agents that only read the root file are routed to current guides.
 */
export function checkGuideMap(options: GuideMapOptions): GuideMapResult {
  const ignored = new Set(options.ignoredDirectories ?? DEFAULT_IGNORED_DIRECTORIES)
  const rootPath = join(options.repoRoot, ROOT_GUIDE)
  const errors: string[] = []
  if (!existsSync(rootPath)) {
    return { errors: [`Missing root ${ROOT_GUIDE}`], guides: [], listed: [] }
  }

  const guides = walkGuides(options.repoRoot, options.repoRoot, ignored).sort()
  const listed = listedGuides(readFileSync(rootPath, 'utf8'))
  const listedSet = new Set(listed)
  const guideSet = new Set(guides)

  for (const guide of guides) {
    if (!listedSet.has(guide)) errors.push(`${guide} is not listed in the root ${ROOT_GUIDE} map`)
  }
  for (const guide of listed) {
    if (!guideSet.has(guide)) errors.push(`Root ${ROOT_GUIDE} references missing guide ${guide}`)
  }

  return { errors, guides, listed }
}
