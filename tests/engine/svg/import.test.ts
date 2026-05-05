import { describe, test, expect, beforeEach } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'
import { importSvg } from '@open-pencil/core/tools'

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

    const frame = graph.getNode(result.id)
    expect(frame).not.toBeUndefined()
    expect(frame!.width).toBe(24)
    expect(frame!.height).toBe(24)

    const children = graph.getChildren(result.id)
    expect(children.length).toBe(1)
    expect(children[0].type).toBe('VECTOR')
    expect(children[0].vectorNetwork).toBeDefined()
    expect(children[0].vectorNetwork!.vertices.length).toBeGreaterThan(0)
  })

  test('imports multiple shapes', async () => {
    const result = (await importSvg.execute(figma, {
      svg: `<svg viewBox="0 0 100 100">
        <rect x="10" y="10" width="30" height="30"/>
        <circle cx="70" cy="30" r="20"/>
        <path d="M10 70 L90 70"/>
      </svg>`
    })) as { id: string }

    const children = graph.getChildren(result.id)
    expect(children.length).toBe(3)
    expect(children.every((c) => c.type === 'VECTOR')).toBe(true)
  })

  test('respects viewBox dimensions', async () => {
    const result = (await importSvg.execute(figma, {
      svg: '<svg viewBox="0 0 200 100"><path d="M0 0 L200 100"/></svg>'
    })) as { id: string }

    const frame = graph.getNode(result.id)
    expect(frame!.width).toBe(200)
    expect(frame!.height).toBe(100)
  })

  test('uses width/height attributes when no viewBox', async () => {
    const result = (await importSvg.execute(figma, {
      svg: '<svg width="48" height="48"><path d="M0 0 L48 48"/></svg>'
    })) as { id: string }

    const frame = graph.getNode(result.id)
    expect(frame!.width).toBe(48)
    expect(frame!.height).toBe(48)
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

    const frame = graph.getNode(result.id)
    expect(frame!.x).toBe(100)
    expect(frame!.y).toBe(200)
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
    expect(children.length).toBe(2)
  })
})
