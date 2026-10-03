import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import {
  canonicalHomeFor,
  checkTestHomes,
  formatBaseline,
  listEngineTests,
  parseBaseline
} from '../src/homes'

const REPO_ROOT = await resolveWorkspaceRoot(import.meta.dir)

async function repoWithBaseline(files: readonly string[]) {
  const repoRoot = await mkdtemp(join(tmpdir(), 'open-pencil-test-homes-'))
  await mkdir(join(repoRoot, 'tools/checks/test-homes'), { recursive: true })
  await writeFile(
    join(repoRoot, 'tools/checks/test-homes/engine-baseline.txt'),
    formatBaseline(files)
  )
  return repoRoot
}

describe('canonicalHomeFor', () => {
  test("maps an engine directory to its owner's canonical home from the shard map", () => {
    expect(canonicalHomeFor('tests/engine/scene-graph/x.test.ts')).toBe(
      'packages/scene-graph/tests'
    )
    expect(canonicalHomeFor('tests/engine/editor/a/b.test.ts')).toBe('packages/core/tests')
    expect(canonicalHomeFor('tests/engine/app/x.test.ts')).toBe('tests/app')
    expect(canonicalHomeFor('tests/engine/unknown/x.test.ts')).toBeUndefined()
  })
})

describe('baseline format', () => {
  test('round-trips sorted entries and ignores comments and blank lines', () => {
    const text = formatBaseline(['tests/engine/b.test.ts', 'tests/engine/a.test.ts'])
    expect(text.startsWith('#')).toBe(true)
    expect(parseBaseline(text)).toEqual(['tests/engine/a.test.ts', 'tests/engine/b.test.ts'])
  })
})

describe('checkTestHomes', () => {
  test('passes when the tree and the baseline agree', async () => {
    const files = ['tests/engine/io/a.test.ts']
    const repoRoot = await repoWithBaseline(files)

    const result = await checkTestHomes({ repoRoot, engineTests: files })

    expect(result).toEqual({ errors: [], remaining: 1 })
  })

  test('rejects a new engine test and points at the canonical home', async () => {
    const repoRoot = await repoWithBaseline([])

    const result = await checkTestHomes({
      repoRoot,
      engineTests: ['tests/engine/scene-graph/new.test.ts']
    })

    expect(result.errors).toEqual([
      'tests/engine/scene-graph/new.test.ts is a new test under tests/engine; put it under packages/scene-graph/tests instead'
    ])
  })

  test('rejects stale baseline entries so the debt only shrinks', async () => {
    const repoRoot = await repoWithBaseline(['tests/engine/io/moved.test.ts'])

    const result = await checkTestHomes({ repoRoot, engineTests: [] })

    expect(result.errors).toEqual([
      'tests/engine/io/moved.test.ts no longer exists; remove it from the baseline'
    ])
  })

  test('fails without a baseline file', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'open-pencil-test-homes-empty-'))

    expect((await checkTestHomes({ repoRoot })).errors).toHaveLength(1)
  })

  test('the committed baseline matches the repository', async () => {
    const result = await checkTestHomes({ repoRoot: REPO_ROOT })

    expect(result.errors).toEqual([])
    expect(result.remaining).toBe((await listEngineTests(REPO_ROOT)).length)
  })
})
