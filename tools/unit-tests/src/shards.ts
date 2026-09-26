import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * Unit test shards, keyed by owning package or application area.
 *
 * Each group lists the owner's canonical test home from
 * `packages/docs/development/testing.md` (`packages/<owner>/tests`,
 * `tests/app`, `tests/integration`) together with the `tests/engine/**`
 * directories it still owns, so a file is discovered from either place and a
 * move needs no shard change. A path that does not exist yet contributes no
 * files. `render` is Core-owned but
 * sharded separately because canvas suites parse large fixtures.
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
    'tests/engine/icons',
    'tests/engine/layout',
    'tests/engine/library',
    'tests/engine/lint',
    'tests/engine/profiler',
    'tests/engine/text',
    'tests/engine/tools',
    'tests/engine/vector'
  ],
  dom: ['packages/dom-css/tests', 'packages/pen/tests', 'tests/engine/dom-css', 'tests/engine/pen'],
  fig: [
    'packages/fig/tests',
    'packages/kiwi/tests',
    'tests/engine/figma',
    'tests/engine/io',
    'tests/engine/kiwi'
  ],
  mcp: ['packages/mcp/tests', 'tests/engine/mcp'],
  render: ['tests/engine/render'],
  'scene-graph': [
    'packages/scene-graph/tests',
    'tests/engine/geometry',
    'tests/engine/hit-test',
    'tests/engine/random',
    'tests/engine/scene-graph',
    'tests/engine/snap'
  ],
  vue: ['packages/vue/tests', 'tests/engine/vue']
} as const

export type UnitTestGroup = keyof typeof UNIT_TEST_GROUPS | 'all'

export const HEAVY_UNIT_TEST_PATTERNS = [
  'tests/engine/clipboard/fixtures/',
  'tests/engine/io/fig/heavy/',
  'tests/engine/io/fig/roundtrip/exhaustive.test.ts',
  'tests/engine/io/fig/roundtrip/glyph-blob.test.ts',
  'tests/engine/io/fig/roundtrip/variables.test.ts',
  'tests/engine/io/fig/export/text.test.ts',
  'tests/engine/io/fig/export/worker.test.ts',
  'tests/engine/io/fig/import/group-reclassify.test.ts',
  'tests/engine/layout/auto-layout/text/measurement.test.ts',
  'tests/engine/render/canvas/cache.test.ts'
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

export async function listUnitTests(
  group: UnitTestGroup,
  options: { includeHeavy?: boolean } = {}
): Promise<string[]> {
  const files = await listTestFiles(pathsForUnitTestGroup(group))
  return options.includeHeavy ? files : files.filter((file) => !isHeavyUnitTest(file))
}

export async function listHeavyUnitTests(group: UnitTestGroup = 'all'): Promise<string[]> {
  const files = await listTestFiles(pathsForUnitTestGroup(group))
  return files.filter(isHeavyUnitTest)
}

async function listTestFiles(paths: string[]): Promise<string[]> {
  const files = await Promise.all(paths.map((path) => listTestFilesInPath(path)))
  return [...new Set(files.flat())].sort()
}

async function listTestFilesInPath(path: string): Promise<string[]> {
  const absolutePath = resolve(REPO_ROOT, path)
  if (!existsSync(absolutePath)) return []
  const entries = await readdir(absolutePath, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const childPath = join(path, entry.name)
      if (entry.isDirectory()) return listTestFilesInPath(childPath)
      if (entry.isFile() && entry.name.endsWith('.test.ts')) return [normalizePath(childPath)]
      return []
    })
  )
  return files.flat()
}

function normalizePath(path: string): string {
  if (!isAbsolute(path)) return path.split(sep).join('/')
  return relative(REPO_ROOT, path).split(sep).join('/') || path.split(sep).join('/')
}
