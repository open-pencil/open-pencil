import { describe, expect, test } from 'bun:test'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { firstPageId, makeSceneGraph } from '@open-pencil/test-support/scene'

import { createSVGNodes } from '#core/io/formats/svg'

import { exportSVGOrThrow, renderNodesToSVGOrThrow, solid } from '../helpers'

const BLACK = solid(0, 0, 0, 1, 1)
const RED = solid(1, 0, 0, 1, 1)
const BLUE = solid(0, 0, 1, 1, 1)

/** The ids the exported content is masked by, in document order. */
function maskRefs(svg: string): string[] {
  return Array.from(svg.matchAll(/mask="url\(#([^)]+)\)"/g), ([, id]) => id)
}

/** The markup of the `<mask>` with `id`. */
function maskDef(svg: string, id: string): string {
  const match = new RegExp(`<mask id="${id}"[^>]*>[\\s\\S]*?</mask>`).exec(svg)
  if (!match) throw new Error(`no <mask id="${id}">`)
  return match[0]
}

/** The SVG without its `<defs>`: what draws. */
function body(svg: string): string {
  return svg.replace(/<defs>[\s\S]*<\/defs>/, '')
}

function frameIn(graph: SceneGraph) {
  return graph.createNode('FRAME', firstPageId(graph), { width: 100, height: 100 })
}

describe('SVG export of masks', () => {
  test('an imported clip path masks what follows it and draws nothing itself (#2274)', () => {
    const graph = makeSceneGraph('Page 1')
    const pageId = firstPageId(graph)
    const frame = createSVGNodes(
      graph,
      pageId,
      `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="30">
        <defs><clipPath id="window"><rect width="20" height="20"/></clipPath></defs>
        <rect width="60" height="30" fill="#ffffff"/>
        <g clip-path="url(#window)"><rect x="10" width="35" height="20" fill="#ff0000"/></g>
      </svg>`
    )
    if (!frame) throw new Error('Expected imported frame')
    const svg = renderNodesToSVGOrThrow(graph, pageId, [frame.id], {
      useAbsoluteBounds: true,
      xmlDeclaration: false
    })
    const [id] = maskRefs(svg)
    expect(maskDef(svg, id)).toContain('fill="#000000"')
    expect(body(svg)).not.toContain('fill="#000000"')
    expect(body(svg)).toContain('fill="#FF0000"')
  })

  test('hidden masks mask nothing and a trailing mask draws nothing', () => {
    const graph = makeSceneGraph('Page 1')
    const frame = frameIn(graph)
    graph.createNode('RECTANGLE', frame.id, { width: 10, height: 10, fills: [BLUE] })
    graph.createNode('RECTANGLE', frame.id, {
      width: 20,
      height: 20,
      isMask: true,
      visible: false,
      fills: [BLACK]
    })
    graph.createNode('RECTANGLE', frame.id, { width: 40, height: 40, fills: [RED] })
    graph.createNode('RECTANGLE', frame.id, { width: 70, height: 70, isMask: true, fills: [BLACK] })

    const svg = exportSVGOrThrow(graph, [frame.id])
    expect(maskRefs(svg)).toEqual([])
    expect(svg).toContain('fill="#FF0000"')
    expect(svg).not.toContain('width="70"')
  })

  test('each visible mask starts a run of its own', () => {
    const graph = makeSceneGraph('Page 1')
    const frame = frameIn(graph)
    graph.createNode('RECTANGLE', frame.id, { width: 30, height: 30, isMask: true, fills: [BLACK] })
    graph.createNode('RECTANGLE', frame.id, { width: 40, height: 40, fills: [RED] })
    graph.createNode('RECTANGLE', frame.id, { width: 50, height: 50, isMask: true, fills: [BLACK] })
    graph.createNode('RECTANGLE', frame.id, { width: 60, height: 60, fills: [BLUE] })

    const svg = exportSVGOrThrow(graph, [frame.id])
    const ids = maskRefs(svg)
    expect(ids).toHaveLength(2)
    expect(maskDef(svg, ids[0])).toContain('width="30" height="30"')
    expect(maskDef(svg, ids[1])).toContain('width="50" height="50"')
  })

  test('an outline mask masks with its shape, whatever its fill opacity', () => {
    const graph = makeSceneGraph('Page 1')
    const frame = frameIn(graph)
    graph.createNode('RECTANGLE', frame.id, {
      width: 30,
      height: 30,
      isMask: true,
      maskType: 'VECTOR',
      fills: [solid(0, 0, 0, 0.25, 0.25)]
    })
    graph.createNode('RECTANGLE', frame.id, { width: 40, height: 40, fills: [RED] })

    const svg = exportSVGOrThrow(graph, [frame.id])
    expect(maskDef(svg, maskRefs(svg)[0])).not.toContain('fill-opacity')
  })

  test('only luminance masks in a run go through the luminance filter', () => {
    const graph = makeSceneGraph('Page 1')
    const frame = frameIn(graph)
    graph.createNode('RECTANGLE', frame.id, {
      width: 20,
      height: 20,
      isMask: true,
      maskType: 'ALPHA',
      fills: [BLACK]
    })
    graph.createNode('RECTANGLE', frame.id, {
      x: 25,
      width: 20,
      height: 20,
      isMask: true,
      maskType: 'LUMINANCE',
      fills: [solid(1, 1, 1, 1, 1)]
    })
    graph.createNode('RECTANGLE', frame.id, { width: 60, height: 20, fills: [BLUE] })

    const svg = exportSVGOrThrow(graph, [frame.id])
    const mask = maskDef(svg, maskRefs(svg)[0])
    expect(mask.match(/filter="url\(/g)).toHaveLength(1)
    expect(mask).toMatch(/^<mask [^>]*>\s*<rect width="20" height="20" fill="#000000"\/>/)
  })

  test('masks share def ids with the clips inside them', () => {
    const graph = makeSceneGraph('Page 1')
    const frame = frameIn(graph)
    for (const x of [0, 40]) {
      const mask = graph.createNode('FRAME', frame.id, {
        x,
        width: 20,
        height: 20,
        clipsContent: true,
        isMask: true,
        maskType: 'VECTOR'
      })
      graph.createNode('RECTANGLE', mask.id, { width: 20, height: 20, fills: [BLACK] })
    }
    graph.createNode('RECTANGLE', frame.id, { width: 100, height: 20, fills: [RED] })

    const svg = exportSVGOrThrow(graph, [frame.id])
    const ids = Array.from(svg.matchAll(/ id="([^"]+)"/g), ([, id]) => id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('preserves bottom-to-top layer order for layerIds across masks and masked siblings', () => {
    const graph = makeSceneGraph('Page 1')
    const pageId = firstPageId(graph)
    const frame = graph.createNode('FRAME', pageId, {
      name: 'Frame',
      width: 100,
      height: 100
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Item',
      width: 20,
      height: 20,
      isMask: true,
      fills: [BLACK]
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Item',
      width: 40,
      height: 40,
      fills: [RED]
    })

    const svg = renderNodesToSVGOrThrow(graph, pageId, [frame.id], {
      layerIds: true,
      xmlDeclaration: false
    })
    const [maskId] = maskRefs(svg)
    expect(maskDef(svg, maskId)).toContain('id="Item"')
    expect(body(svg)).toContain('id="Item_2"')
  })
})
