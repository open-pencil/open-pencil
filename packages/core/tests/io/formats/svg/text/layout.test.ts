import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '@open-pencil/test-support/assert'
import { SceneGraph } from '@open-pencil/scene-graph'
import { pixelLength } from '@open-pencil/scene-graph/text'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'
import { renderNodesToSVG } from '#core/io/formats/svg'
import { withCanvasTextLayout } from '#core/io/formats/svg/text/layout'
import { fontManager } from '#core/text/font/manager'

const SENTENCE = 'A sentence long enough that it has to wrap onto a second line.'

beforeAll(async () => {
  const inter = expectDefined(await fontManager.fetchBundledFont('/InterVariable.ttf'), 'Inter')
  await fontManager.markLoaded('Inter', 'Regular', inter)
})

test('an SVG export sets text on the canvas baselines, a wrapped paragraph on its lines', async () => {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const node = graph.createNode('TEXT', pageId, {
    text: SENTENCE,
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: pixelLength(24),
    width: 230,
    height: 48,
    textAutoResize: 'HEIGHT'
  })
  const io = new IORegistry(BUILTIN_IO_FORMATS)
  const result = await io.exportContent('svg', {
    graph,
    target: { scope: 'node', nodeId: node.id }
  })
  if (typeof result.data !== 'string') throw new Error('Expected SVG markup')
  const baselines = [...result.data.matchAll(/<tspan [^>]*y="([\d.]+)"/g)].map(([, y]) => Number(y))
  // Two 24 px lines, each baseline below half the leading and the font's ascent, not at 13.
  expect(baselines).toHaveLength(2)
  expect(baselines[0]).toBeGreaterThan(13)
  expect(baselines[1] - baselines[0]).toBeCloseTo(24)
})

test('a paragraph wrapped on the canvas keeps its lines in the SVG', async () => {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const node = graph.createNode('TEXT', pageId, {
    text: SENTENCE,
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: pixelLength(16),
    width: 230,
    height: 32,
    textAutoResize: 'HEIGHT'
  })

  const svg = await withCanvasTextLayout(async (textLayout) => {
    const lines = expectDefined(textLayout?.(node), 'text lines')
    expect(lines).toHaveLength(2)
    expect(lines[1].start).toBe(lines[0].end)
    expect(lines[1].end).toBe(SENTENCE.length)
    expect(lines[1].y - lines[0].y).toBe(16)
    return renderNodesToSVG(graph, pageId, [node.id], { xmlDeclaration: false, textLayout })
  })

  const spans = expectDefined(svg, 'SVG').match(/<tspan [^>]*>[^<]*<\/tspan>/g) ?? []
  expect(spans).toHaveLength(2)
  expect(spans.map((span) => span.replace(/<[^>]+>/g, '')).join('')).toBe(SENTENCE)
})

test('a style run that starts mid-word is placed where the canvas draws its first letter', async () => {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const node = graph.createNode('TEXT', pageId, {
    text: 'Bold',
    fontFamily: 'Inter',
    fontSize: 20,
    width: 200,
    height: 24,
    styleRuns: [{ start: 1, length: 3, style: { letterSpacing: pixelLength(4) } }]
  })

  const svg = await withCanvasTextLayout(async (textLayout) => {
    const [line] = expectDefined(textLayout?.(node), 'text lines')
    const o = expectDefined(line.characters?.get(1), 'edges of "o"')
    const b = expectDefined(line.characters?.get(0), 'edges of "B"')
    expect(o.left).toBeCloseTo(b.right, 3)
    return renderNodesToSVG(graph, pageId, [node.id], { xmlDeclaration: false, textLayout })
  })

  const spans = expectDefined(svg, 'SVG').match(/<tspan [^>]*>/g) ?? []
  expect(spans).toHaveLength(2)
  expect(spans.every((span) => / x="[\d.]+"/.test(span))).toBe(true)
})

test('text whose case changes its length is kept on one line, in that case', async () => {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const node = graph.createNode('TEXT', pageId, {
    text: 'Straße',
    textCase: 'UPPER',
    fontFamily: 'Inter',
    fontSize: 20,
    width: 200,
    height: 24
  })

  const svg = await withCanvasTextLayout(async (textLayout) => {
    expect(textLayout?.(node)).toBeNull()
    return renderNodesToSVG(graph, pageId, [node.id], { xmlDeclaration: false, textLayout })
  })

  expect(expectDefined(svg, 'SVG')).toContain('>STRASSE</text>')
})
