import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { figThumbnailSize } from '#cli-tests/helpers/fig'
import { CLI_ENTRY, FIXTURES } from '#cli-tests/helpers/paths'
import * as v from 'valibot'

import { getTextMeasurer } from '@open-pencil/core/layout'

import { loadDocument, measureDocumentText } from '#cli/headless'

setDefaultTimeout(60_000)

async function cli(args: string[], stdin?: string) {
  const proc = Bun.spawn([process.execPath, CLI_ENTRY, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: stdin ? Buffer.from(stdin) : undefined
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: await proc.exited }
}

describe('eval CLI', () => {
  test('measures the text a script edits in the font the document sets for it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-eval-fonts-'))
    const source = join(dir, 'tag.pen')
    const output = join(dir, 'tag.fig')
    // Inter at 600 is not among the faces the measurer starts with.
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
                content: '1 lote',
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
    const script = `figma.root.findOne((node) => node.type === 'TEXT').characters = '1 lote propuesto'`
    expect((await cli(['eval', source, '--stdin', '-o', output], script)).exitCode).toBe(0)

    const graph = await loadDocument(output)
    const label = [...graph.getAllNodes()].find((node) => node.type === 'TEXT')
    if (!label) throw new Error('Expected the label')
    await measureDocumentText(graph)
    const measured = getTextMeasurer()?.(label)
    if (!measured) throw new Error('Expected the label measured in its font')
    expect(label.width).toBeCloseTo(measured.width, 0)
    expect(label.height).toBeCloseTo(measured.height, 0)
  })

  test('measures the text a script writes, its line breaks and wrapping included', async () => {
    const script = `
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
      const line = figma.createText()
      line.characters = 'one'
      const lines = figma.createText()
      lines.characters = 'one\\ntwo\\nthree'
      const paragraph = figma.createText()
      paragraph.characters = 'A paragraph that wraps over several lines'
      paragraph.resize(80, 20)
      paragraph.textAutoResize = 'HEIGHT'
      return { line: line.height, lines: lines.height, paragraph: paragraph.height }
    `
    const result = await cli(
      ['eval', join(FIXTURES, 'circle-text.fig'), '--stdin', '--json'],
      script
    )
    expect(result.exitCode).toBe(0)
    const heights = v.parse(
      v.pipe(
        v.string(),
        v.parseJson(),
        v.object({ line: v.number(), lines: v.number(), paragraph: v.number() })
      ),
      result.stdout
    )
    expect(heights.lines).toBeGreaterThan(heights.line * 2)
    expect(heights.paragraph).toBeGreaterThan(heights.line * 2)
  })

  test('saves a script’s edits laid out, though the script never read them back', async () => {
    const out = join(await mkdtemp(join(tmpdir(), 'open-pencil-eval-')), 'badge.fig')
    // A hugging badge whose label a property shortens: its saved width fits the new label.
    const script = `
      const badge = figma.createComponent()
      badge.name = 'Badge'
      badge.layoutMode = 'HORIZONTAL'
      badge.paddingLeft = badge.paddingRight = 10
      badge.primaryAxisSizingMode = 'AUTO'
      badge.counterAxisSizingMode = 'AUTO'
      const label = figma.createText()
      label.characters = 'Placeholder'
      badge.appendChild(label)
      const prop = badge.addComponentProperty('Label', 'TEXT', 'Placeholder')
      label.componentPropertyReferences = { characters: prop }
      const instance = badge.createInstance()
      instance.name = 'Short'
      instance.setProperties({ [prop]: '2' })
    `
    const written = await cli(
      ['eval', join(FIXTURES, 'gold-preview.fig'), '--stdin', '-o', out, '-q'],
      script
    )
    expect(written.exitCode).toBe(0)
    const read = await cli([
      'eval',
      out,
      '--json',
      '--code',
      `
        const short = figma.currentPage.findOne((n) => n.name === 'Short')
        const badge = figma.currentPage.findOne((n) => n.type === 'COMPONENT' && n.name === 'Badge')
        return [short.width < badge.width, short.children[0].width < badge.children[0].width]
      `
    ])
    const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), v.array(v.boolean())), read.stdout)
    expect(parsed.success && parsed.output).toEqual([true, true])
  })

  test('--write saves a thumbnail of the Cover page', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-eval-'))
    const html = join(dir, 'tall.html')
    const file = join(dir, 'cover.fig')
    await writeFile(html, '<div style="width:100px;height:400px;background:#000"></div>')
    expect((await cli(['import', html, '-o', file])).exitCode).toBe(0)

    const script = `
      const cover = figma.createPage()
      cover.name = 'Cover'
      const card = figma.createRectangle()
      card.resize(300, 200)
      cover.appendChild(card)
    `
    expect((await cli(['eval', file, '--stdin', '-w', '-q'], script)).exitCode).toBe(0)

    const { width, height } = figThumbnailSize(await readFile(file))
    // Not the 1 × 1 placeholder, and the Cover page's 3:2 card rather than the first page's.
    expect(Math.min(width, height)).toBeGreaterThan(1)
    expect(width / height).toBeCloseTo(300 / 200, 2)
  })
})
