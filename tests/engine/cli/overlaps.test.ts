import { expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SceneGraph } from '@open-pencil/core'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'

import { isLfsPointer } from '#tests/helpers/lfs'
import { cliSourcePath, repoPath, requireBuiltWorkspacePackages } from '#tests/helpers/paths'
import { heavy } from '#tests/helpers/test-utils'

requireBuiltWorkspacePackages()

setDefaultTimeout(30_000)

const CLI = cliSourcePath('index.ts')
const FIXTURE = repoPath('tests/fixtures/gold-preview.fig')
const fixtureIsLfs = isLfsPointer(FIXTURE)

async function makeTwoPageFixture(): Promise<string> {
  const graph = new SceneGraph()
  const page1 = graph.getPages()[0].id
  const page2 = graph.addPage('Page 2')

  graph.createNode('RECTANGLE', page1, { name: 'A', x: 0, y: 0, width: 100, height: 100 })
  graph.createNode('RECTANGLE', page1, { name: 'B', x: 50, y: 50, width: 100, height: 100 })
  graph.createNode('RECTANGLE', page2.id, { name: 'C', x: 0, y: 0, width: 100, height: 100 })
  graph.createNode('RECTANGLE', page2.id, { name: 'D', x: 50, y: 50, width: 100, height: 100 })

  const data = await exportFigFile(graph)
  const dir = mkdtempSync(join(tmpdir(), 'overlap-cli-'))
  const file = join(dir, 'two-pages.fig')
  writeFileSync(file, data)
  return file
}

async function run(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['bun', CLI, ...args], {
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  const exitCode = await proc.exited
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}

heavy('analyze overlaps CLI', () => {
  test.skipIf(fixtureIsLfs)('--json returns valid overlap data', async () => {
    const { stdout, exitCode } = await run(['analyze', 'overlaps', FIXTURE, '--json'])
    expect(exitCode).toBe(0)
    const data = JSON.parse(stdout)
    expect(data.overlaps).toBeArray()
    expect(typeof data.summary.totalNodes).toBe('number')
    expect(typeof data.summary.analyzedNodes).toBe('number')
    expect(typeof data.summary.overlapCount).toBe('number')
  })

  test.skipIf(fixtureIsLfs)('human-readable mode prints a summary', async () => {
    const { stdout, exitCode } = await run(['analyze', 'overlaps', FIXTURE])
    expect(exitCode).toBe(0)
    expect(stdout.length).toBeGreaterThan(0)
    expect(stdout).toContain('analyzed nodes')
  })

  test.skipIf(fixtureIsLfs)('invalid scope exits with error', async () => {
    const { exitCode, stderr } = await run(['analyze', 'overlaps', FIXTURE, '--scope', 'invalid'])
    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('Invalid scope')
  })

  test.skipIf(fixtureIsLfs)('invalid severity exits with error', async () => {
    const { exitCode, stderr } = await run([
      'analyze',
      'overlaps',
      FIXTURE,
      '--severity',
      'invalid'
    ])
    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('Invalid severity')
  })

  test.skipIf(fixtureIsLfs)('invalid category exits with error', async () => {
    const { exitCode, stderr } = await run(['analyze', 'overlaps', FIXTURE, '--category', 'bogus'])
    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('Invalid categor')
  })

  test.skipIf(fixtureIsLfs)('invalid --min-area exits with error', async () => {
    const { exitCode, stderr } = await run(['analyze', 'overlaps', FIXTURE, '--min-area', 'abc'])
    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('--min-area')
  })

  test.skipIf(fixtureIsLfs)('invalid --limit exits with error', async () => {
    const { exitCode, stderr } = await run(['analyze', 'overlaps', FIXTURE, '--limit', '0'])
    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('--limit')
  })

  test.skipIf(fixtureIsLfs)('--category filters results', async () => {
    const { stdout, exitCode } = await run([
      'analyze',
      'overlaps',
      FIXTURE,
      '--json',
      '--category',
      'parent-overflow'
    ])
    expect(exitCode).toBe(0)
    const data = JSON.parse(stdout)
    expect(data.overlaps.every((o: { category: string }) => o.category === 'parent-overflow')).toBe(
      true
    )
  })

  test.skipIf(fixtureIsLfs)('scope argument is case-insensitive', async () => {
    const { stdout, exitCode } = await run([
      'analyze',
      'overlaps',
      FIXTURE,
      '--json',
      '--scope',
      'SAME-PARENT'
    ])
    expect(exitCode).toBe(0)
    const data = JSON.parse(stdout)
    expect(data.overlaps).toBeArray()
    expect(typeof data.summary.totalNodes).toBe('number')
  })

  test('default mode scopes analysis to the first page only', async () => {
    const fixture = await makeTwoPageFixture()
    const { stdout, exitCode } = await run(['analyze', 'overlaps', fixture, '--json'])
    expect(exitCode).toBe(0)
    const data = JSON.parse(stdout)
    expect(data.summary.overlapCount).toBe(1)
    expect(data.summary.totalNodes).toBe(2)
    expect(data.overlaps[0].nodeA.name).toBe('A')
    expect(data.overlaps[0].nodeB.name).toBe('B')
  })

  test('--page scopes analysis to the named page', async () => {
    const fixture = await makeTwoPageFixture()
    const { stdout, exitCode } = await run([
      'analyze',
      'overlaps',
      fixture,
      '--json',
      '--page',
      'Page 2'
    ])
    expect(exitCode).toBe(0)
    const data = JSON.parse(stdout)
    expect(data.summary.overlapCount).toBe(1)
    expect(data.summary.totalNodes).toBe(2)
    expect(data.overlaps[0].nodeA.name).toBe('C')
    expect(data.overlaps[0].nodeB.name).toBe('D')
  })
})
