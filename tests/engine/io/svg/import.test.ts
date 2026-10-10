import { describe, test, expect, beforeEach } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { FigmaAPI, renderNodesToSVG, SceneGraph } from '@open-pencil/core'
import { importSVG } from '@open-pencil/core/tools'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'

let graph: SceneGraph
let figma: FigmaAPI

beforeEach(() => {
  graph = new SceneGraph()
  figma = new FigmaAPI(graph)
})

describe('import_svg', () => {
  test('imports a simple path', async () => {
    const result = (await importSVG.execute(figma, {
      svg: '<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20Z"/></svg>'
    })) as { id: string; name: string; type: string }

    expect(result.id).toBeDefined()
    expect(result.type).toBe('FRAME')

    const frame = getNodeOrThrow(graph, result.id)
    expect(frame.width).toBe(24)
    expect(frame.height).toBe(24)

    const children = graph.getChildren(result.id)
    expect(children.length).toBe(1)
    expect(children[0].type).toBe('VECTOR')
    expect(children[0].vectorNetwork).toBeDefined()
    expect(
      expectDefined(children[0].vectorNetwork, 'imported vector network').vertices.length
    ).toBeGreaterThan(0)
  })

  test('imports each filled shape as its own vector', async () => {
    const result = (await importSVG.execute(figma, {
      svg: `<svg viewBox="0 0 100 100">
        <rect x="0" y="0" width="50" height="50" fill="#ff0000"/>
        <rect x="50" y="0" width="50" height="50" fill="#00ff00"/>
        <rect x="0" y="50" width="100" height="50" fill="#0000ff"/>
      </svg>`
    })) as { id: string }

    const children = graph.getChildren(result.id)
    expect(children.map((child) => child.type)).toEqual(['VECTOR', 'VECTOR', 'VECTOR'])
    expect(expectDefined(children[0].fills[0]).color.r).toBeCloseTo(1)
    expect(expectDefined(children[1].fills[0]).color.g).toBeCloseTo(1)
    expect(expectDefined(children[2].fills[0]).color.b).toBeCloseTo(1)

    const page = expectDefined(graph.getPages()[0])
    const exported = expectDefined(renderNodesToSVG(graph, page.id, [result.id]))
    expect(exported.match(/fill="#FF0000"/g)).toHaveLength(1)
    expect(exported.match(/fill="#00FF00"/g)).toHaveLength(1)
    expect(exported.match(/fill="#0000FF"/g)).toHaveLength(1)
  })

  test('imports a real multi-path provider SVG shape by shape', async () => {
    const svg = readFileSync(
      join(process.cwd(), 'tests/fixtures/vectorize/euro_shield.recraft.svg'),
      'utf8'
    )
    const result = (await importSVG.execute(figma, { svg })) as { id: string }

    const children = graph.getChildren(result.id)
    expect(children).toHaveLength(svg.match(/<path\b/g)?.length ?? 0)
    expect(children.every((child) => child.type === 'VECTOR')).toBe(true)
  })

  test('keeps paint order around stroked paths', async () => {
    const result = (await importSVG.execute(figma, {
      svg: `<svg viewBox="0 0 100 100">
        <rect x="0" y="0" width="20" height="20" fill="#ff0000"/>
        <rect x="20" y="0" width="20" height="20" fill="#ff8800"/>
        <path d="M0 30H100" fill="none" stroke="#000000"/>
        <rect x="0" y="40" width="20" height="20" fill="#0000ff"/>
        <rect x="20" y="40" width="20" height="20" fill="#00ff00"/>
      </svg>`
    })) as { id: string }

    const children = graph.getChildren(result.id)
    expect(children.map((child) => child.strokes.length)).toEqual([0, 0, 1, 0, 0])
    expect(children.map((child) => Math.round(child.y))).toEqual([0, 0, 30, 40, 40])
  })

  test('maps each shape gradient to its own vector bounds', async () => {
    const result = (await importSVG.execute(figma, {
      svg: `<svg viewBox="0 0 100 50"><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="50" height="50" fill="url(#g)"/><rect x="50" width="50" height="50" fill="url(#g)"/></svg>`
    })) as { id: string }

    for (const vector of graph.getChildren(result.id)) {
      const transform = expectDefined(vector.fills[0]?.gradientTransform)
      expect(transform.m00).toBeCloseTo(1)
      expect(transform.m02).toBeCloseTo(0)
    }

    const page = expectDefined(graph.getPages()[0])
    const exported = expectDefined(renderNodesToSVG(graph, page.id, [result.id]))
    expect(exported.match(/<linearGradient/g)).toHaveLength(2)
    expect(exported.match(/fill="url\(#/g)).toHaveLength(2)
  })

  // Gradients export in Figma's convention with an exact gradientTransform, so a turned gradient on
  // a stretched layer comes back with the transform it left with.
  test('a turned linear gradient survives an SVG round trip', async () => {
    const page = expectDefined(graph.getPages()[0])
    const c = Math.SQRT1_2
    const rect = graph.createNode('RECTANGLE', page.id, {
      width: 200,
      height: 120,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: c, m01: c, m02: 0.5 - c, m10: -c, m11: c, m12: 0.5 }
        }
      ]
    })
    const exported = expectDefined(renderNodesToSVG(graph, page.id, [rect.id]))
    const result = (await importSVG.execute(figma, { svg: exported })) as { id: string }
    const imported = expectDefined(graph.getChildren(result.id)[0]?.fills[0]?.gradientTransform)
    const original = expectDefined(rect.fills[0]?.gradientTransform)
    for (const key of ['m00', 'm01', 'm02', 'm10', 'm11', 'm12'] as const)
      expect(imported[key]).toBeCloseTo(original[key], 4)
  })

  test('respects viewBox dimensions', async () => {
    const result = (await importSVG.execute(figma, {
      svg: '<svg viewBox="0 0 200 100"><path d="M0 0 L200 100"/></svg>'
    })) as { id: string }

    const frame = getNodeOrThrow(graph, result.id)
    expect(frame.width).toBe(200)
    expect(frame.height).toBe(100)
  })

  test('uses width/height attributes when no viewBox', async () => {
    const result = (await importSVG.execute(figma, {
      svg: '<svg width="48" height="48"><path d="M0 0 L48 48"/></svg>'
    })) as { id: string }

    const frame = getNodeOrThrow(graph, result.id)
    expect(frame.width).toBe(48)
    expect(frame.height).toBe(48)
  })

  test('sets custom name', async () => {
    const result = (await importSVG.execute(figma, {
      svg: '<svg viewBox="0 0 24 24"><path d="M0 0 L24 24"/></svg>',
      name: 'Arrow'
    })) as { id: string; name: string }

    expect(result.name).toBe('Arrow')
  })

  test('applies fill color', async () => {
    const result = (await importSVG.execute(figma, {
      svg: '<svg viewBox="0 0 24 24"><path d="M0 0 L24 24" fill="#FF0000"/></svg>'
    })) as { id: string }

    const children = graph.getChildren(result.id)
    expect(children[0].fills.length).toBe(1)
    expect(children[0].fills[0].color.r).toBeCloseTo(1, 1)
    expect(children[0].fills[0].color.g).toBeCloseTo(0, 1)
  })

  test('applies stroke', async () => {
    const result = (await importSVG.execute(figma, {
      svg: '<svg viewBox="0 0 24 24"><path d="M0 0 L24 24" fill="none" stroke="#00FF00" stroke-width="2"/></svg>'
    })) as { id: string }

    const children = graph.getChildren(result.id)
    expect(children[0].fills.length).toBe(0)
    expect(children[0].strokes.length).toBe(1)
    expect(children[0].strokes[0].color.g).toBeCloseTo(1, 1)
    expect(children[0].strokes[0].weight).toBe(2)
  })

  test('uses currentColor with custom color arg', async () => {
    const result = (await importSVG.execute(figma, {
      svg: '<svg viewBox="0 0 24 24"><path d="M0 0 L24 24" fill="currentColor"/></svg>',
      color: '#0000FF'
    })) as { id: string }

    const children = graph.getChildren(result.id)
    expect(children[0].fills[0].color.b).toBeCloseTo(1, 1)
    expect(children[0].fills[0].color.r).toBeCloseTo(0, 1)
  })

  test('sets position', async () => {
    const result = (await importSVG.execute(figma, {
      svg: '<svg viewBox="0 0 24 24"><path d="M0 0 L24 24"/></svg>',
      x: 100,
      y: 200
    })) as { id: string }

    const frame = getNodeOrThrow(graph, result.id)
    expect(frame.x).toBe(100)
    expect(frame.y).toBe(200)
  })

  test('returns error for empty SVG', async () => {
    const result = (await importSVG.execute(figma, {
      svg: '<svg viewBox="0 0 24 24"></svg>'
    })) as { error: string }

    expect(result.error).toContain('No supported SVG elements')
  })

  test('rejects a missing svg input before executing', () => {
    const nodeCount = graph.nodes.size
    expect(() => importSVG.execute(figma, {})).toThrow('Expected "svg"')
    expect(graph.nodes.size).toBe(nodeCount)
  })

  test('handles polygon and polyline', async () => {
    const result = (await importSVG.execute(figma, {
      svg: `<svg viewBox="0 0 100 100">
        <polygon points="50,5 95,97 5,97"/>
        <polyline points="10,10 40,40 70,10"/>
      </svg>`
    })) as { id: string }

    // SVG fills a polyline as if it were closed.
    const children = graph.getChildren(result.id)
    expect(children).toHaveLength(2)
    for (const child of children) expect(expectDefined(child.vectorNetwork).regions).toHaveLength(1)
  })

  test('applies nested transforms through the XML tree', async () => {
    const result = (await importSVG.execute(figma, {
      svg: `<svg viewBox="0 0 100 100"><g transform="translate(40 30)"><rect width="10" height="20"/></g></svg>`
    })) as { id: string }

    const path = getNodeOrThrow(graph, graph.getChildren(result.id)[0].id)
    expect(path.x).toBeCloseTo(40)
    expect(path.y).toBeCloseTo(30)
    expect(path.width).toBeCloseTo(10)
    expect(path.height).toBeCloseTo(20)
  })

  test('honors preserveAspectRatio when mapping the viewBox', async () => {
    const result = (await importSVG.execute(figma, {
      svg: `<svg width="200" height="200" viewBox="0 0 100 50"><rect width="100" height="50"/></svg>`
    })) as { id: string }

    const path = graph.getChildren(result.id)[0]
    expect(path.x).toBeCloseTo(0)
    expect(path.y).toBeCloseTo(50)
    expect(path.width).toBeCloseTo(200)
    expect(path.height).toBeCloseTo(100)
  })

  test('supports preserveAspectRatio none', async () => {
    const result = (await importSVG.execute(figma, {
      svg: `<svg width="200" height="200" viewBox="0 0 100 50" preserveAspectRatio="none"><rect width="100" height="50"/></svg>`
    })) as { id: string }

    const path = graph.getChildren(result.id)[0]
    expect(path.x).toBeCloseTo(0)
    expect(path.y).toBeCloseTo(0)
    expect(path.width).toBeCloseTo(200)
    expect(path.height).toBeCloseTo(200)
  })

  test('resolves internal use references and inline presentation styles', async () => {
    const result = (await importSVG.execute(figma, {
      svg: `<svg viewBox="0 0 100 100"><defs><path id="tile" d="M0 0H10V10H0Z"/></defs><use href="#tile" x="20" y="30" style="fill: #0000ff"/></svg>`
    })) as { id: string }

    const path = graph.getChildren(result.id)[0]
    expect(path.x).toBeCloseTo(20)
    expect(path.y).toBeCloseTo(30)
    expect(path.fills[0].color.b).toBeCloseTo(1)
  })

  test('imports a clip path as a mask group around the clipped layers', async () => {
    const result = (await importSVG.execute(figma, {
      svg: `<svg viewBox="0 0 100 100">
        <defs><path id="mark" d="M10 10H90V90H10Z"/></defs>
        <g clip-path="url(#clip)">
          <defs><clipPath id="clip"><use href="#mark"/></clipPath></defs>
          <rect width="50" height="100" fill="#ff0000"/>
          <rect x="50" width="50" height="100" fill="#0000ff"/>
        </g>
        <circle cx="50" cy="50" r="10" fill="#ffffff"/>
      </svg>`
    })) as { id: string }

    const [clipGroup, circle] = graph.getChildren(result.id)
    expect(clipGroup?.name).toBe('Clip path group')
    const [mask, content] = graph.getChildren(expectDefined(clipGroup).id)
    expect(mask?.type).toBe('GROUP')
    expect(mask?.name).toBe('clip')
    expect(mask?.isMask).toBe(true)
    expect(mask?.maskType).toBe('VECTOR')
    expect(graph.getChildren(expectDefined(mask).id)).toHaveLength(1)
    expect(graph.getChildren(expectDefined(content).id)).toHaveLength(2)
    expect(circle?.isMask).toBe(false)
  })

  test('keeps an inherited clip when expanding use elements', async () => {
    const result = (await importSVG.execute(figma, {
      svg: `<svg viewBox="0 0 100 100">
        <defs>
          <path id="tile" d="M0 0H100V100H0Z"/>
          <clipPath id="clip"><rect x="20" y="20" width="60" height="60"/></clipPath>
        </defs>
        <g clip-path="url(#clip)"><use href="#tile" fill="#ff0000"/></g>
      </svg>`
    })) as { id: string }

    const clipGroup = expectDefined(graph.getChildren(result.id)[0])
    const [mask, content] = graph.getChildren(clipGroup.id)
    expect(mask?.isMask).toBe(true)
    const [tile] = graph.getChildren(expectDefined(content).id)
    expect(tile?.fills[0]?.color.r).toBeCloseTo(1)
  })

  test('applies nested clip paths from outermost to innermost', async () => {
    const result = (await importSVG.execute(figma, {
      svg: `<svg viewBox="0 0 100 100">
        <defs>
          <clipPath id="outer"><rect x="10" y="10" width="80" height="80"/></clipPath>
          <clipPath id="inner"><circle cx="50" cy="50" r="25"/></clipPath>
        </defs>
        <g clip-path="url(#outer)">
          <rect width="100" height="100" fill="#ff0000" clip-path="url(#inner)"/>
        </g>
      </svg>`
    })) as { id: string }

    const outer = expectDefined(graph.getChildren(result.id)[0])
    const [outerMask, outerContent] = graph.getChildren(outer.id)
    expect(outerMask?.name).toBe('outer')
    const inner = expectDefined(graph.getChildren(expectDefined(outerContent).id)[0])
    const [innerMask, rect] = graph.getChildren(inner.id)
    expect(innerMask?.name).toBe('inner')
    expect(rect?.type).toBe('VECTOR')
  })

  test('maps objectBoundingBox clip paths to each painted path bounds', async () => {
    const result = (await importSVG.execute(figma, {
      svg: `<svg viewBox="0 0 200 100">
        <defs>
          <clipPath id="half" clipPathUnits="objectBoundingBox">
            <rect width="0.5" height="1"/>
          </clipPath>
        </defs>
        <rect x="20" y="10" width="60" height="80" fill="#ff0000" clip-path="url(#half)"/>
        <rect x="120" y="20" width="40" height="60" fill="#0000ff" clip-path="url(#half)"/>
      </svg>`
    })) as { id: string }

    const masks = graph
      .getChildren(result.id)
      .map((clipGroup) => expectDefined(graph.getChildren(clipGroup.id)[0]))
    expect(masks.map(({ x, y, width, height }) => [x, y, width, height])).toEqual([
      [0, 0, 30, 80],
      [0, 0, 20, 60]
    ])
    expect(graph.getChildren(result.id).map(({ x, y }) => [x, y])).toEqual([
      [20, 10],
      [120, 20]
    ])
  })

  test('imports gradient fills through the shared SVG pipeline', async () => {
    const result = (await importSVG.execute(figma, {
      svg: `<svg viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`
    })) as { id: string }

    expect(graph.getChildren(result.id)[0].fills[0].type).toBe('GRADIENT_LINEAR')
  })
})
