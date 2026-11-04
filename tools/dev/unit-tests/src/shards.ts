import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

import { uniq } from 'es-toolkit/array'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

const REPO_ROOT = await resolveWorkspaceRoot(import.meta.dir)

/**
 * Unit test shards, keyed by owning package or application area.
 *
 * Each group lists the owner's canonical test home from
 * `packages/docs/development/testing.md` (`packages/<owner>/tests`,
 * `tests/app`, `tests/integration`) together with the `tests/engine/**`
 * directories it still owns, so a file is discovered from either place and a
 * move needs no shard change. A path that does not exist yet contributes no
 * files. A file belongs to the group with the longest path that contains it, so
 * `render` takes Core's canvas suites, which parse large fixtures, into a shard
 * of their own while `core` keeps the rest of `packages/core/tests`.
 */
export const UNIT_TEST_GROUPS = {
  app: [
    'tests/app',
    'tests/integration',
    'tests/engine/acp',
    'tests/engine/app',
    'tests/engine/collab',
    'tests/engine/tauri'
  ],
  cli: ['packages/cli/tests', 'tests/engine/cli'],
  core: [
    'packages/core/tests',
    'tests/engine/clipboard',
    'tests/engine/color',
    'tests/engine/core',
    'tests/engine/editor',
    'packages/core/tests/icons',
    'tests/engine/layout',
    'packages/core/tests/lint',
    'packages/core/tests/profiler',
    'packages/core/tests/text',
    'packages/core/tests/tools',
    'packages/core/tests/vector'
  ],
  dom: [
    'packages/emit/tests',
    'packages/drawio/tests',
    'packages/mermaid/tests',
    'packages/design-jsx/tests',
    'packages/dom-css/tests',
    'packages/pen/tests',
    'tests/engine/dom-css'
  ],
  fig: ['packages/fig/tests', 'packages/kiwi/tests', 'tests/engine/io', 'tests/engine/kiwi'],
  mcp: ['packages/mcp/tests', 'tests/engine/mcp'],
  render: ['packages/core/tests/canvas'],
  'scene-graph': [
    'packages/scene-graph/tests',
    'packages/collab/tests',
    'tests/engine/geometry',
    'tests/engine/hit-test',
    'tests/engine/random',
    'tests/engine/scene-graph',
    'tests/engine/snap'
  ],
  vue: ['packages/vue/tests', 'tests/engine/vue']
} as const

export type UnitTestGroup = keyof typeof UNIT_TEST_GROUPS | 'all'

/**
 * Fixture corpora of tens of megabytes; parsing one takes gigabytes, so every test that reads
 * them is heavy and runs in its own process.
 */
export const LARGE_FIXTURES = ['material3.fig', 'nuxtui.fig'] as const

/**
 * Tests that parse large fixtures. Quick runs skip them, and full runs give each its own
 * process, since one alone can take several gigabytes.
 */
export const HEAVY_UNIT_TEST_PATTERNS = [
  'packages/core/tests/clipboard/fixtures/',
  'packages/core/tests/io/formats/fig/heavy/',
  'packages/core/tests/io/formats/fig/roundtrip/exhaustive.test.ts',
  'packages/core/tests/io/formats/fig/roundtrip/glyph-blob.test.ts',
  'packages/core/tests/io/formats/fig/roundtrip/variables.test.ts',
  'packages/core/tests/io/formats/fig/import/stale-overrides.test.ts',
  'packages/core/tests/io/formats/fig/export/text/basic.test.ts',
  'packages/core/tests/io/formats/fig/export/worker.test.ts',
  'packages/core/tests/io/formats/fig/import/group-reclassify.test.ts',
  'packages/core/tests/layout/auto-layout/text/measurement.test.ts',
  'packages/core/tests/canvas/cache.test.ts'
] as const

export function unitTestGroupNames(): UnitTestGroup[] {
  return [...Object.keys(UNIT_TEST_GROUPS), 'all'] as UnitTestGroup[]
}

export function pathsForUnitTestGroup(group: UnitTestGroup): string[] {
  if (group === 'all') return Object.values(UNIT_TEST_GROUPS).flat()
  return [...UNIT_TEST_GROUPS[group]]
}

export function isHeavyUnitTest(path: string): boolean {
  const normalized = normalizePath(path)
  return HEAVY_UNIT_TEST_PATTERNS.some(
    (pattern) => normalized.startsWith(pattern) || normalized === pattern
  )
}

/** The shard path that owns a test file: the longest one containing it. */
export function owningUnitTestPath(file: string): string | undefined {
  const normalized = normalizePath(file)
  return pathsForUnitTestGroup('all')
    .filter((path) => normalized.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0]
}

/** A group's test files, without those a more specific path of another group owns. */
async function listGroupTestFiles(group: UnitTestGroup): Promise<string[]> {
  const paths = pathsForUnitTestGroup(group)
  const files = await listTestFiles(paths)
  return files.filter((file) => {
    const owner = owningUnitTestPath(file)
    return owner !== undefined && paths.includes(owner)
  })
}

export async function listUnitTests(
  group: UnitTestGroup,
  options: { includeHeavy?: boolean } = {}
): Promise<string[]> {
  const files = await listGroupTestFiles(group)
  return options.includeHeavy ? files : files.filter((file) => !isHeavyUnitTest(file))
}

export async function listHeavyUnitTests(group: UnitTestGroup = 'all'): Promise<string[]> {
  const files = await listGroupTestFiles(group)
  return files.filter(isHeavyUnitTest)
}

async function listTestFiles(paths: string[]): Promise<string[]> {
  const files = await Promise.all(paths.map((path) => listTestFilesInPath(path)))
  return uniq(files.flat()).sort()
}

async function listTestFilesInPath(path: string): Promise<string[]> {
  const absolutePath = resolve(REPO_ROOT, path)
  if (!existsSync(absolutePath)) return []
  const entries = await readdir(absolutePath, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const childPath = join(path, entry.name)
      if (entry.isDirectory()) return listTestFilesInPath(childPath)
      if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) return [normalizePath(childPath)]
      return []
    })
  )
  return files.flat()
}

function normalizePath(path: string): string {
  if (!isAbsolute(path)) return path.split(sep).join('/')
  return relative(REPO_ROOT, path).split(sep).join('/') || path.split(sep).join('/')
}
