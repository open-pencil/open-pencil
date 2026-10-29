import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { figThumbnailSize } from '#cli-tests/helpers/fig'
import { CLI_ENTRY } from '#cli-tests/helpers/paths'

import { getTextMeasurer } from '@open-pencil/core/layout'

import { loadDocument, measureDocumentText } from '#cli/headless'

setDefaultTimeout(60_000)

async function cli(args: string[]) {
  const proc = Bun.spawn([process.execPath, CLI_ENTRY, ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: await proc.exited }
}

describe('convert CLI', () => {
  test('saves a .pen document with its text measured in its own fonts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-convert-'))
    const source = join(dir, 'tag.pen')
    const output = join(dir, 'tag.fig')
    await Bun.write(
      source,
      JSON.stringify({
        version: '2.21',
        children: [
          {
            id: 'tag',
            type: 'frame',
            layout: 'horizontal',
            padding: [4, 10],
            children: [
              {
                id: 'label',
                type: 'text',
                content: '1 lote propuesto',
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: '600',
                fill: '#111111'
              }
            ]
          }
        ]
      })
    )
    expect((await cli(['convert', source, '-o', output])).exitCode).toBe(0)

    const graph = await loadDocument(output)
    const label = [...graph.getAllNodes()].find((node) => node.type === 'TEXT')
    if (!label) throw new Error('Expected the label')
    await measureDocumentText(graph)
    const measured = getTextMeasurer()?.(label)
    if (!measured) throw new Error('Expected the label measured in its font')
    expect(label.width).toBeCloseTo(measured.width, 0)
    expect(graph.getNode(label.parentId ?? '')?.width).toBeCloseTo(measured.width + 20, 0)
  })

  test('reports a font it cannot load, and with --font-policy strict writes nothing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-convert-fonts-'))
    const source = join(dir, 'note.pen')
    await Bun.write(
      source,
      JSON.stringify({
        version: '2.21',
        children: [
          { id: 'note', type: 'text', content: 'Hola', fontFamily: 'Definitely Missing Font' }
        ]
      })
    )
    const warned = await cli(['convert', source, '-o', join(dir, 'warned.fig')])
    expect(warned.exitCode).toBe(0)
    expect(warned.stderr).toContain('Definitely Missing Font')
    expect(await Bun.file(join(dir, 'warned.fig')).exists()).toBe(true)

    const strict = await cli([
      'convert',
      source,
      '-o',
      join(dir, 'strict.fig'),
      '--font-policy',
      'strict'
    ])
    expect(strict.exitCode).not.toBe(0)
    expect(await Bun.file(join(dir, 'strict.fig')).exists()).toBe(false)
  })

  test('saves a .fig with a thumbnail of its layers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-convert-'))
    const source = join(dir, 'card.pen')
    const output = join(dir, 'card.fig')
    await Bun.write(
      source,
      JSON.stringify({
        version: '2.21',
        children: [{ id: 'card', type: 'rectangle', width: 300, height: 200, fill: '#111111' }]
      })
    )
    expect((await cli(['convert', source, '-o', output])).exitCode).toBe(0)

    const { width, height } = figThumbnailSize(await readFile(output))
    expect(width / height).toBeCloseTo(300 / 200, 2)
  })
})
