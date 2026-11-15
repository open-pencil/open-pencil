import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { writeFourPageFig } from '#cli-tests/helpers/fig'
import { runCLI } from '#cli-tests/helpers/run'

setDefaultTimeout(60_000)

/** The JSON a command prints with `--json`, after checking it succeeded. */
async function json(args: string[]): Promise<unknown> {
  const { stdout, stderr, exitCode } = await runCLI([...args, '--json'])
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  return JSON.parse(stdout)
}

describe('--page and --page-id on a file', () => {
  test('pick the same page in every command that runs on one page', async () => {
    const { path, pageIds } = await writeFourPageFig()
    const byName = ['--page', 'Page 3']
    const byId = ['--page-id', pageIds[2]]

    for (const page of [byName, byId]) {
      expect(await json(['tree', path, ...page])).toMatchObject([{ name: 'Frame 3' }])
      expect(await json(['find', path, '--type', 'FRAME', ...page])).toMatchObject([
        { name: 'Frame 3' }
      ])
      expect(await json(['query', path, '//FRAME', ...page])).toMatchObject([{ name: 'Frame 3' }])
      expect(await json(['eval', path, ...page, '--code', 'return figma.currentPage.name'])).toBe(
        'Page 3'
      )
      expect(await json(['tool', 'call', 'get_current_page', path, ...page])).toMatchObject({
        name: 'Page 3'
      })
    }
  })

  test('export the page either names', async () => {
    const { path, pageIds } = await writeFourPageFig()
    const output = join(await mkdtemp(join(tmpdir(), 'open-pencil-page-export-')), 'page.png')
    for (const page of [
      ['--page', 'Page 3'],
      ['--page-id', pageIds[2]]
    ]) {
      const { stdout, exitCode } = await runCLI([
        'export',
        path,
        ...page,
        '-f',
        'png',
        '-o',
        output
      ])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('Target: page "Page 3"')
    }
  })

  test('cannot be passed together, nor with --node to export', async () => {
    const { path, pageIds } = await writeFourPageFig()
    const both = await runCLI(['tree', path, '--page', 'Page 3', '--page-id', pageIds[2]])
    expect(both.exitCode).toBe(1)
    expect(both.stderr).toContain('--page and --page-id cannot be used together.')

    const withNode = await runCLI(['export', path, '--page-id', pageIds[2], '--node', '1:2'])
    expect(withNode.exitCode).toBe(1)
    expect(withNode.stderr).toContain('--page-id and --node cannot be used together.')
  })

  test('name a page the document lacks in the same words everywhere', async () => {
    const { path } = await writeFourPageFig()
    for (const command of [
      ['tree', path],
      ['find', path, '--name', 'Frame'],
      ['query', path, '//FRAME'],
      ['eval', path, '--code', 'return 1']
    ]) {
      const { exitCode, stderr } = await runCLI([...command, '--page-id', '9:9'])
      expect(exitCode).toBe(1)
      expect(stderr).toContain('Page "9:9" not found')
    }
  })
})
