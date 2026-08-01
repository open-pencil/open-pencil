import { describe, test, expect, beforeEach } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { FigmaAPI, renderNodesToSVG, SceneGraph } from '@open-pencil/core'
import { importSvg } from '@open-pencil/core/tools'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'

let graph: SceneGraph
let figma: FigmaAPI

beforeEach(() => {
  graph = new SceneGraph()
  figma = new FigmaAPI(graph)
})

describe('import_svg', () => {
  test('imports a simple path', async () => {
    const result = (await importSvg.execute(figma, {
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

  test('flattens compatible filled shapes into one vector', async () => {
    const result = (await importSvg.execute(figma, {
      svg: `<svg viewBox="0 0 100 100">
        <rect x="0" y="0" width="50" height="50" fill="#ff0000"/>
        <rect x="50" y="0" width="50" height="50" fill="#00ff00"/>
        <rect x="0" y="50" width="100" height="50" fill="#0000ff"/>
      </svg>`
    })) as { id: string }

    const children = graph.getChildren(result.id)
    expect(children).toHaveLength(1)
    const vector = expectDefined(children[0])
    expect(vector.type).toBe('VECTOR')
    expect(expectDefined(vector.vectorNetwork).regions).toHaveLength(3)
    expect(vector.fillGeometry).toHaveLength(3)
    expect(expectDefined(vector.fillGeometry[0]?.fills?.[0]).color.r).toBeCloseTo(1)
    expect(expectDefined(vector.fillGeometry[1]?.fills?.[0]).color.g).toBeCloseTo(1)
    expect(expectDefined(vector.fillGeometry[2]?.fills?.[0]).color.b).toBeCloseTo(1)
    expect(vector.fillGeometry.every(({ commandsBlob }) => commandsBlob.length > 0)).toBe(true)

    const page = expectDefined(graph.getPages()[0])
    const exported = expectDefined(renderNodesToSVG(graph, page.id, [result.id]))
    expect(exported.match(/fill="#FF0000"/g)).toHaveLength(1)
    expect(exported.match(/fill="#00FF00"/g)).toHaveLength(1)
    expect(exported.match(/fill="#0000FF"/g)).toHaveLength(1)
  })

  test('flattens a real multi-path provider SVG', async () => {
    const svg = readFileSync(
      join(process.cwd(), 'tests/fixtures/vectorize/euro_shield.recraft.svg'),
      'utf8'
    )
    const result = (await importSvg.execute(figma, { svg })) as { id: string }

    const vector = expectDefined(graph.getChildren(result.id)[0])
    const network = expectDefined(vector.vectorNetwork)
    expect(graph.getChildren(result.id)).toHaveLength(1)
    expect(network.regions.length).toBeGreaterThan(10)
    expect(vector.fillGeometry).toHaveLength(network.regions.length)
  })

  test('preserves paint order around stroked paths', async () => {
    const result = (await importSvg.execute(figma, {
      svg: `<svg viewBox="0 0 100 100">
        <rect x="0" y="0" width="20" height="20" fill="#ff0000"/>
        <rect x="20" y="0" width="20" height="20" fill="#ff8800"/>
        <path d="M0 30H100" fill="none" stroke="#000000"/>
        <rect x="0" y="40" width="20" height="20" fill="#0000ff"/>
        <rect x="20" y="40" width="20" height="20" fill="#00ff00"/>
      </svg>`
    })) as { id: string }

    const children = graph.getChildren(result.id)
    expect(children).toHaveLength(3)
    expect(expectDefined(children[0]).fillGeometry).toHaveLength(2)
    expect(expectDefined(children[1]).strokes).toHaveLength(1)
    expect(expectDefined(children[2]).fillGeometry).toHaveLength(2)
  })

  test('remaps path gradients into flattened vector bounds', async () => {
    const result = (await importSvg.execute(figma, {
      svg: `<svg viewBox="0 0 100 50"><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="50" height="50" fill="url(#g)"/><rect x="50" width="50" height="50" fill="url(#g)"/></svg>`
    })) as { id: string }

    const vector = expectDefined(graph.getChildren(result.id)[0])
    const left = expectDefined(vector.fillGeometry[0]?.fills?.[0]?.gradientTransform)
    const right = expectDefined(vector.fillGeometry[1]?.fills?.[0]?.gradientTransform)
    expect(left.m00).toBeCloseTo(0.5)
    expect(left.m02).toBeCloseTo(0)
    expect(right.m00).toBeCloseTo(0.5)
    expect(right.m02).toBeCloseTo(0.5)

    const page = expectDefined(graph.getPages()[0])
    const exported = expectDefined(renderNodesToSVG(graph, page.id, [result.id]))
    expect(exported.match(/<linearGradient/g)).toHaveLength(2)
    expect(exported.match(/fill="url\(#/g)).toHaveLength(2)
  })

  test('respects viewBox dimensions', async () => {
    const result = (await importSvg.execute(figma, {
      svg: '<svg viewBox="0 0 200 100"><path d="M0 0 L200 100"/></svg>'
    })) as { id: string }

    const frame = getNodeOrThrow(graph, result.id)
    expect(frame.width).toBe(200)
    expect(frame.height).toBe(100)
  })

  test('uses width/height attributes when no viewBox', async () => {
    const result = (await importSvg.execute(figma, {
      svg: '<svg width="48" height="48"><path d="M0 0 L48 48"/></svg>'
    })) as { id: string }

    const frame = getNodeOrThrow(graph, result.id)
    expect(frame.width).toBe(48)
    expect(frame.height).toBe(48)
  })

  test('sets custom name', async () => {
    const result = (await importSvg.execute(figma, {
      svg: '<svg viewBox="0 0 24 24"><path d="M0 0 L24 24"/></svg>',
      name: 'Arrow'
    })) as { id: string; name: string }

    expect(result.name).toBe('Arrow')
  })

  test('applies fill color', async () => {
    const result = (await importSvg.execute(figma, {
      svg: '<svg viewBox="0 0 24 24"><path d="M0 0 L24 24" fill="#FF0000"/></svg>'
    })) as { id: string }

    const children = graph.getChildren(result.id)
    expect(children[0].fills.length).toBe(1)
    expect(children[0].fills[0].color.r).toBeCloseTo(1, 1)
    expect(children[0].fills[0].color.g).toBeCloseTo(0, 1)
  })

  test('applies stroke', async () => {
    const result = (await importSvg.execute(figma, {
      svg: '<svg viewBox="0 0 24 24"><path d="M0 0 L24 24" fill="none" stroke="#00FF00" stroke-width="2"/></svg>'
    })) as { id: string }

    const children = graph.getChildren(result.id)
    expect(children[0].fills.length).toBe(0)
    expect(children[0].strokes.length).toBe(1)
    expect(children[0].strokes[0].color.g).toBeCloseTo(1, 1)
    expect(children[0].strokes[0].weight).toBe(2)
  })

  test('uses currentColor with custom color arg', async () => {
    const result = (await importSvg.execute(figma, {
      svg: '<svg viewBox="0 0 24 24"><path d="M0 0 L24 24" fill="currentColor"/></svg>',
      color: '#0000FF'
    })) as { id: string }

    const children = graph.getChildren(result.id)
    expect(children[0].fills[0].color.b).toBeCloseTo(1, 1)
    expect(children[0].fills[0].color.r).toBeCloseTo(0, 1)
  })

  test('sets position', async () => {
    const result = (await importSvg.execute(figma, {
      svg: '<svg viewBox="0 0 24 24"><path d="M0 0 L24 24"/></svg>',
      x: 100,
      y: 200
    })) as { id: string }

    const frame = getNodeOrThrow(graph, result.id)
    expect(frame.x).toBe(100)
    expect(frame.y).toBe(200)
  })

  test('returns error for empty SVG', async () => {
    const result = (await importSvg.execute(figma, {
      svg: '<svg viewBox="0 0 24 24"></svg>'
    })) as { error: string }

    expect(result.error).toContain('No supported SVG elements')
  })

  test('returns error for missing svg param', async () => {
    const result = (await importSvg.execute(figma, {})) as { error: string }
    expect(result.error).toContain('required')
  })

  test('handles polygon and polyline', async () => {
    const result = (await importSvg.execute(figma, {
      svg: `<svg viewBox="0 0 100 100">
        <polygon points="50,5 95,97 5,97"/>
        <polyline points="10,10 40,40 70,10"/>
      </svg>`
    })) as { id: string }

    const children = graph.getChildren(result.id)
    expect(children).toHaveLength(2)
    expect(children.every(({ vectorNetwork }) => vectorNetwork !== null)).toBe(true)
  })

  test('applies nested transforms through the XML tree', async () => {
    const result = (await importSvg.execute(figma, {
      svg: `<svg viewBox="0 0 100 100"><g transform="translate(40 30)"><rect width="10" height="20"/></g></svg>`
    })) as { id: string }

    const path = getNodeOrThrow(graph, graph.getChildren(result.id)[0].id)
    expect(path.x).toBeCloseTo(40)
    expect(path.y).toBeCloseTo(30)
    expect(path.width).toBeCloseTo(10)
    expect(path.height).toBeCloseTo(20)
  })

  test('honors preserveAspectRatio when mapping the viewBox', async () => {
    const result = (await importSvg.execute(figma, {
      svg: `<svg width="200" height="200" viewBox="0 0 100 50"><rect width="100" height="50"/></svg>`
    })) as { id: string }

    const path = graph.getChildren(result.id)[0]
    expect(path.x).toBeCloseTo(0)
    expect(path.y).toBeCloseTo(50)
    expect(path.width).toBeCloseTo(200)
    expect(path.height).toBeCloseTo(100)
  })

  test('supports preserveAspectRatio none', async () => {
    const result = (await importSvg.execute(figma, {
      svg: `<svg width="200" height="200" viewBox="0 0 100 50" preserveAspectRatio="none"><rect width="100" height="50"/></svg>`
    })) as { id: string }

    const path = graph.getChildren(result.id)[0]
    expect(path.x).toBeCloseTo(0)
    expect(path.y).toBeCloseTo(0)
    expect(path.width).toBeCloseTo(200)
    expect(path.height).toBeCloseTo(200)
  })

  test('resolves internal use references and inline presentation styles', async () => {
    const result = (await importSvg.execute(figma, {
      svg: `<svg viewBox="0 0 100 100"><defs><path id="tile" d="M0 0H10V10H0Z"/></defs><use href="#tile" x="20" y="30" style="fill: #0000ff"/></svg>`
    })) as { id: string }

    const path = graph.getChildren(result.id)[0]
    expect(path.x).toBeCloseTo(20)
    expect(path.y).toBeCloseTo(30)
    expect(path.fills[0].color.b).toBeCloseTo(1)
  })

  test('imports gradient fills through the shared SVG pipeline', async () => {
    const result = (await importSvg.execute(figma, {
      svg: `<svg viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`
    })) as { id: string }

    expect(graph.getChildren(result.id)[0].fills[0].type).toBe('GRADIENT_LINEAR')
  })
})
