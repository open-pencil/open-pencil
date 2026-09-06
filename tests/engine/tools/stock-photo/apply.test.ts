import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'
import type { NodeType } from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'

import { applyPhoto } from '#core/tools/stock-photo/apply'
import type { StockPhotoProvider } from '#core/tools/stock-photo/providers'

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PHOTO_URL = `data:image/png;base64,${PNG_BYTES.toBase64()}`

interface ProviderCall {
  query: string
  options: {
    perPage: number
    orientation: 'landscape' | 'portrait' | 'square'
    targetDim: number
  }
}

function createProvider(calls: ProviderCall[]): StockPhotoProvider {
  return {
    name: 'test',
    async search(query, options) {
      calls.push({ query, options })
      return [
        {
          url: PHOTO_URL,
          width: 1600,
          height: 900,
          photographer: 'Test Photographer',
          sourceId: 'photo-1'
        }
      ]
    }
  }
}

function setup() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected default page')
  return { graph, page, figma: new FigmaAPI(graph) }
}

const AREA_TARGET_TYPES = [
  'FRAME',
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'ELLIPSE',
  'STAR',
  'POLYGON',
  'COMPONENT',
  'INSTANCE'
] as const satisfies readonly NodeType[]

const UNSUITABLE_TARGET_TYPES = [
  'CANVAS',
  'GROUP',
  'TEXT',
  'LINE',
  'SECTION',
  'COMPONENT_SET',
  'CONNECTOR',
  'SHAPE_WITH_TEXT'
] as const satisfies readonly NodeType[]

describe('applyPhoto', () => {
  for (const type of AREA_TARGET_TYPES) {
    test(`applies a photo to an empty ${type}`, async () => {
      const { graph, page, figma } = setup()
      const node = graph.createNode(type, page.id, {
        name: `${type} target`,
        x: 12,
        y: 24,
        width: 320,
        height: 180
      })
      const calls: ProviderCall[] = []

      const result = await applyPhoto(figma, createProvider(calls), {
        id: node.id,
        query: 'mountain sunset',
        orientation: 'landscape'
      })

      expect(result.error).toBeUndefined()
      expect(result.photo).toMatchObject({ sourceId: 'photo-1', provider: 'test' })
      expect(calls).toEqual([
        {
          query: 'mountain sunset',
          options: { perPage: 3, orientation: 'landscape', targetDim: 320 }
        }
      ])
      expect(node.fills[0]).toMatchObject({ type: 'IMAGE', imageScaleMode: 'FILL' })
      expect(graph.images.size).toBe(1)
      expect({ x: node.x, y: node.y, width: node.width, height: node.height }).toEqual({
        x: 12,
        y: 24,
        width: 320,
        height: 180
      })
    })
  }

  test('applies a photo to closed vector geometry', async () => {
    const { graph, page, figma } = setup()
    const vector = graph.createNode('VECTOR', page.id, {
      name: 'Closed vector',
      width: 100,
      height: 100,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 3, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
      }
    })
    const calls: ProviderCall[] = []

    const result = await applyPhoto(figma, createProvider(calls), {
      id: vector.id,
      query: 'marble texture'
    })

    expect(result.error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(vector.fills[0]).toMatchObject({ type: 'IMAGE', imageScaleMode: 'FILL' })
  })

  test('rejects open vector geometry before searching', async () => {
    const { graph, page, figma } = setup()
    const vector = graph.createNode('VECTOR', page.id, {
      name: 'Open vector',
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 100 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    })
    const originalFills = copyFills(vector.fills)
    const calls: ProviderCall[] = []

    const result = await applyPhoto(figma, createProvider(calls), {
      id: vector.id,
      query: 'should not run'
    })

    expect(result.error).toBe(
      `"${vector.name}" has no closed vector regions — use closed area geometry`
    )
    expect(calls).toHaveLength(0)
    expect(vector.fills).toEqual(originalFills)
    expect(graph.images.size).toBe(0)
  })

  test('applies a photo to Boolean geometry with operand children', async () => {
    const { graph, page, figma } = setup()
    const operation = graph.createNode('BOOLEAN_OPERATION', page.id, {
      name: 'Combined shape',
      width: 200,
      height: 120
    })
    graph.createNode('RECTANGLE', operation.id)
    graph.createNode('ELLIPSE', operation.id)
    const calls: ProviderCall[] = []

    const result = await applyPhoto(figma, createProvider(calls), {
      id: operation.id,
      query: 'abstract texture'
    })

    expect(result.error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(operation.fills[0]).toMatchObject({ type: 'IMAGE', imageScaleMode: 'FILL' })
  })

  for (const type of UNSUITABLE_TARGET_TYPES) {
    test(`rejects ${type} before searching`, async () => {
      const { graph, page, figma } = setup()
      const node =
        type === 'CANVAS'
          ? page
          : graph.createNode(type, page.id, {
              name: `${type} target`,
              fills: [
                {
                  type: 'SOLID',
                  color: { r: 1, g: 0, b: 0, a: 1 },
                  opacity: 1,
                  visible: true
                }
              ]
            })
      const originalFills = copyFills(node.fills)
      const calls: ProviderCall[] = []

      const result = await applyPhoto(figma, createProvider(calls), {
        id: node.id,
        query: 'should not run'
      })

      expect(result.error).toContain(`(${type}) is not a suitable stock photo target`)
      expect(calls).toHaveLength(0)
      expect(node.fills).toEqual(originalFills)
      expect(graph.images.size).toBe(0)
    })
  }

  for (const type of ['FRAME', 'COMPONENT', 'INSTANCE'] as const satisfies readonly NodeType[]) {
    test(`rejects ${type} content containers before searching`, async () => {
      const { graph, page, figma } = setup()
      const container = graph.createNode(type, page.id, {
        name: `${type} with content`,
        fills: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 1, a: 1 },
            opacity: 1,
            visible: true
          }
        ]
      })
      const child = graph.createNode('RECTANGLE', container.id)
      const originalFills = copyFills(container.fills)
      const calls: ProviderCall[] = []

      const result = await applyPhoto(figma, createProvider(calls), {
        id: container.id,
        query: 'should not run'
      })

      expect(result.error).toBe(`"${container.name}" has children — use a leaf image placeholder`)
      expect(calls).toHaveLength(0)
      expect(container.fills).toEqual(originalFills)
      expect(graph.getNode(child.id)).toBe(child)
      expect(graph.images.size).toBe(0)
    })
  }
})
