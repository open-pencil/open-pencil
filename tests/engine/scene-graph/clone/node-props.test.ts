import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/core'
import { cloneNodeProps } from '@open-pencil/scene-graph/copy'

function pageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

describe('cloneNodeProps deep-copies vectorNetwork', () => {
  test('cloned vectorNetwork is not the same reference as original', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Vector',
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: [{ windingRule: 'NONZERO', loops: [[0, 1]] }]
      }
    })
    const original = graph.getNode(node.id)
    const clone = graph.cloneTree(node.id, pageId(graph))
    const clonedNode = graph.getNode(clone.id)

    expect(clonedNode.vectorNetwork).not.toBe(original.vectorNetwork)
    if (original.vectorNetwork && clonedNode.vectorNetwork) {
      expect(clonedNode.vectorNetwork.vertices).not.toBe(original.vectorNetwork.vertices)
      expect(clonedNode.vectorNetwork.segments).not.toBe(original.vectorNetwork.segments)
      expect(clonedNode.vectorNetwork.regions).not.toBe(original.vectorNetwork.regions)
    }
  })

  test('mutating clone vectorNetwork does not affect original', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Vector',
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 50 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    })
    const original = graph.getNode(node.id)
    const clone = graph.cloneTree(node.id, pageId(graph))
    const clonedNode = graph.getNode(clone.id)

    if (clonedNode.vectorNetwork) clonedNode.vectorNetwork.vertices[0].x = 999
    expect(original.vectorNetwork?.vertices[0].x).toBe(0)
  })
})

describe('cloneNodeProps deep-copies textPicture and figmaDerivedTextGlyphs', () => {
  test('cloned textPicture is not the same reference as original', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'Text',
      text: 'Hello',
      fontSize: 14,
      fontFamily: 'Inter',
      textPicture: new Uint8Array([1, 2, 3, 4])
    })
    const original = graph.getNode(node.id)
    const clone = graph.cloneTree(node.id, pageId(graph))
    const clonedNode = graph.getNode(clone.id)

    expect(clonedNode.textPicture).not.toBe(original.textPicture)
    if (original.textPicture && clonedNode.textPicture) {
      clonedNode.textPicture[0] = 99
      expect(original.textPicture[0]).toBe(1)
    }
  })

  test('cloned figmaDerivedTextGlyphs is not the same reference as original', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'Text',
      text: 'Hi',
      fontSize: 14,
      fontFamily: 'Inter',
      figmaDerivedTextGlyphs: [
        { commandsBlob: new Uint8Array([10, 20]), x: 0, y: 0, fontSize: 14 },
        { commandsBlob: new Uint8Array([30, 40]), x: 10, y: 0, fontSize: 14 }
      ]
    })
    const original = graph.getNode(node.id)
    const clone = graph.cloneTree(node.id, pageId(graph))
    const clonedNode = graph.getNode(clone.id)

    expect(clonedNode.figmaDerivedTextGlyphs).not.toBe(original.figmaDerivedTextGlyphs)
    if (original.figmaDerivedTextGlyphs && clonedNode.figmaDerivedTextGlyphs) {
      expect(clonedNode.figmaDerivedTextGlyphs[0]).not.toBe(original.figmaDerivedTextGlyphs[0])
      expect(clonedNode.figmaDerivedTextGlyphs[0].commandsBlob).not.toBe(
        original.figmaDerivedTextGlyphs[0].commandsBlob
      )
      clonedNode.figmaDerivedTextGlyphs[0].commandsBlob[0] = 99
      expect(original.figmaDerivedTextGlyphs[0].commandsBlob[0]).toBe(10)
    }
  })
})

describe('cloneNodeProps deep-copies overrides values', () => {
  test('mutating clone overrides does not affect original', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const component = graph.createNode('COMPONENT', page, { name: 'Comp', width: 100, height: 40 })
    graph.createNode('RECTANGLE', component.id, {
      name: 'Bg',
      width: 100,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    const instance = graph.createInstance(component.id, page)
    if (!instance) throw new Error('instance failed')
    const instanceChild = graph.getChildren(instance.id)[0]
    instance.overrides[`${instanceChild.id}:fills`] = [
      { type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, visible: true, opacity: 1 }
    ]

    const clone = graph.cloneTree(instance.id, page)
    if (!clone) throw new Error('clone failed')
    const clonedInstance = graph.getNode(clone.id)
    const overrideKey = `${instanceChild.id}:fills`
    const cloneOverrideVal = clonedInstance.overrides[overrideKey] as Array<{
      color: { r: number }
    }>
    if (cloneOverrideVal) cloneOverrideVal[0].color.r = 0.5

    const origOverrideVal = instance.overrides[overrideKey] as Array<{ color: { r: number } }>
    if (origOverrideVal) expect(origOverrideVal[0].color.r).toBe(0)
  })
})

describe('cloneNodeProps coverage guard', () => {
  test('cloneNodeProps does not crash when array fields are undefined', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const node = graph.createNode('RECTANGLE', page, { name: 'Rect' })
    const raw = graph.getNode(node.id)
    const patch: Partial<
      Pick<
        SceneNode,
        | 'componentPropertyDefinitions'
        | 'symbolLinks'
        | 'exportSettings'
        | 'pluginData'
        | 'pluginRelaunchData'
      >
    > = {
      componentPropertyDefinitions: undefined,
      symbolLinks: undefined,
      exportSettings: undefined,
      pluginData: undefined,
      pluginRelaunchData: undefined
    }
    Object.assign(raw, patch)
    expect(() => graph.cloneTree(node.id, page)).not.toThrow()
  })

  test('cloneNodeProps does not share mutable object fields by default', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const node = graph.createNode('RECTANGLE', page, {
      name: 'Rich node',
      boundVariables: { 'fills/0/color': 'v1' },
      overrides: { nested: { value: true } },
      vectorNetwork: {
        vertices: [{ x: 0, y: 0 }],
        segments: [{ start: 0, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: [{ windingRule: 'NONZERO', loops: [[0]] }]
      },
      source: {
        format: 'fig',
        id: 'source-node',
        orderKey: 'a',
        fig: {
          rawSize: { x: 1, y: 2 },
          rawTransform: null,
          rawNodeFields: { nested: { survives: true } },
          layout: null,
          symbolOverrides: [],
          componentPropAssignments: [],
          derivedSymbolData: [],
          derivedSymbolDataLayoutVersion: 1,
          uniformScaleFactor: 1
        }
      },
      textPicture: new Uint8Array([1, 2, 3]),
      figmaDerivedTextGlyphs: [{ commandsBlob: new Uint8Array([4, 5]), x: 0, y: 0, fontSize: 12 }],
      gridPosition: { column: 1, row: 1, columnSpan: 1, rowSpan: 1 }
    })

    const cloneProps = cloneNodeProps(node, null)
    for (const [key, value] of Object.entries(node) as Array<[keyof SceneNode, unknown]>) {
      if (key === 'id' || key === 'parentId' || key === 'childIds') continue
      if (value && typeof value === 'object') {
        expect(cloneProps[key], `field ${String(key)} should be copied`).not.toBe(value)
      }
    }

    const clonedNestedRaw = cloneProps.source?.fig.rawNodeFields.nested as { survives: boolean }
    clonedNestedRaw.survives = false
    const originalNestedRaw = node.source.fig.rawNodeFields.nested as { survives: boolean }
    expect(originalNestedRaw.survives).toBe(true)
  })
})
