import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { runCLI } from '#cli-tests/helpers/run'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as v from 'valibot'

import { FIXTURES } from '@open-pencil/test-support/paths'
setDefaultTimeout(60_000)

const FIXTURE = join(FIXTURES, 'gold-preview.fig')

function parseJSON<T>(text: string, schema: v.GenericSchema<unknown, T>): T {
  return v.parse(v.pipe(v.string(), v.parseJson(), schema), text)
}
describe('tool CLI', () => {
  test('lists and describes tools with their effect and argument schema', async () => {
    const listed = await runCLI(['tool', 'list', '--json'])
    expect(listed.exitCode).toBe(0)
    const tools = parseJSON(
      listed.stdout,
      v.array(v.looseObject({ name: v.string(), effect: v.string() }))
    )
    expect(tools).toContainEqual(expect.objectContaining({ name: 'set_fill', effect: 'write' }))
    expect(tools).toContainEqual(expect.objectContaining({ name: 'list_pages', effect: 'read' }))

    const described = await runCLI(['tool', 'describe', 'create_page', '--json'])
    expect(described.exitCode).toBe(0)
    const info = parseJSON(
      described.stdout,
      v.looseObject({ schema: v.looseObject({ properties: v.record(v.string(), v.unknown()) }) })
    )
    expect(info.schema.properties).toHaveProperty('name')
  })

  test('calls a write tool headlessly and saves the result with --output', async () => {
    const outPath = join(await mkdtemp(join(tmpdir(), 'open-pencil-tool-')), 'out.fig')
    const created = await runCLI([
      'tool',
      'call',
      'create_page',
      FIXTURE,
      '--args',
      '{"name":"From CLI"}',
      '--output',
      outPath,
      '--json'
    ])
    expect(created.exitCode).toBe(0)
    expect(JSON.parse(created.stdout)).toMatchObject({ name: 'From CLI' })

    const pages = await runCLI(['tool', 'call', 'list_pages', outPath, '--json'])
    const result = parseJSON(
      pages.stdout,
      v.looseObject({ pages: v.array(v.looseObject({ name: v.string() })) })
    )
    expect(result.pages.map((page) => page.name)).toContain('From CLI')
  })

  test('rejects unknown tools and non-object arguments', async () => {
    const unknown = await runCLI(['tool', 'call', 'not_a_tool', FIXTURE])
    expect(unknown.exitCode).toBe(1)
    expect(unknown.stderr + unknown.stdout).toContain('Unknown tool "not_a_tool"')

    const appWrite = await runCLI(['tool', 'call', 'create_page', '--output', 'out.fig'])
    expect(appWrite.exitCode).toBe(1)
    expect(appWrite.stderr).toContain('--write and --output need a document file')

    const badArgs = await runCLI(['tool', 'call', 'list_pages', FIXTURE, '--args', '[1]'])
    expect(badArgs.exitCode).toBe(1)
    expect(badArgs.stderr + badArgs.stdout).toContain('Tool arguments must be a JSON object')
  })
})
