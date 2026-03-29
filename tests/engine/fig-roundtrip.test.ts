import { describe, test, expect, beforeAll, setDefaultTimeout } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import {
  parseFigFile,
  exportFigFile,
  importNodeChanges,
  initCodec,
  SceneGraph,
  type SceneNode,
  type NodeType,
  type Fill,
} from '@open-pencil/core'
import { heavy } from '../helpers/test-utils'

setDefaultTimeout(60_000)

const FIXTURES = resolve(import.meta.dir, '../fixtures')

const VALID_NODE_TYPES = new Set<string>([
  'CANVAS',
  'FRAME',
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'ELLIPSE',
  'TEXT',
  'LINE',
  'STAR',
  'POLYGON',
  'VECTOR',
  'GROUP',
  'SECTION',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
  'CONNECTOR',
  'SHAPE_WITH_TEXT',
])

function collectAllNodes(graph: SceneGraph): SceneNode[] {
  const all: SceneNode[] = []
  function walk(id: string) {
    const node = graph.getNode(id)
    if (!node) return
    all.push(node)
    for (const child of graph.getChildren(id)) {
      walk(child.id)
    }
  }
  for (const page of graph.getPages()) {
    for (const child of graph.getChildren(page.id)) {
      walk(child.id)
    }
  }
  return all
}

function countByType(nodes: SceneNode[]): Map<NodeType, number> {
  const counts = new Map<NodeType, number>()
  for (const n of nodes) {
    counts.set(n.type, (counts.get(n.type) ?? 0) + 1)
  }
  return counts
}

let parsed: SceneGraph
let allNodes: SceneNode[]

beforeAll(async () => {
  const buf = readFileSync(resolve(FIXTURES, 'gold-preview.fig'))
  parsed = await parseFigFile(buf.buffer as ArrayBuffer)
  allNodes = collectAllNodes(parsed)
})

describe('parse real .fig files', () => {
  test('parses without error', () => {
    expect(parsed).toBeInstanceOf(SceneGraph)
  })

  test('has pages', () => {
    expect(parsed.getPages().length).toBeGreaterThan(0)
  })

  test('has nodes', () => {
    expect(allNodes.length).toBeGreaterThan(0)
  })
})

describe('node type coverage', () => {
  test('contains FRAME nodes', () => {
    expect(allNodes.some((n) => n.type === 'FRAME')).toBe(true)
  })

  test('contains TEXT nodes with content', () => {
    const textNodes = allNodes.filter((n) => n.type === 'TEXT')
    expect(textNodes.length).toBeGreaterThan(0)
    expect(textNodes.some((n) => n.text.length > 0)).toBe(true)
  })

  test('contains INSTANCE nodes referencing components', () => {
    const instances = allNodes.filter((n) => n.type === 'INSTANCE')
    expect(instances.length).toBeGreaterThan(0)
    expect(instances.some((n) => n.componentId)).toBe(true)
  })

  test('no unmapped node types', () => {
    const invalid = allNodes.filter((n) => !VALID_NODE_TYPES.has(n.type))
    expect(invalid.map((n) => `${n.name}: ${n.type}`)).toEqual([])
  })
})

describe('property integrity', () => {
  test('all nodes have finite dimensions', () => {
    for (const n of allNodes) {
      expect(Number.isFinite(n.width)).toBe(true)
      expect(Number.isFinite(n.height)).toBe(true)
      expect(n.width).toBeGreaterThanOrEqual(0)
      expect(n.height).toBeGreaterThanOrEqual(0)
    }
  })

  test('all nodes have finite positions', () => {
    for (const n of allNodes) {
      expect(Number.isFinite(n.x)).toBe(true)
      expect(Number.isFinite(n.y)).toBe(true)
    }
  })

  test('all nodes have valid opacity', () => {
    for (const n of allNodes) {
      expect(n.opacity).toBeGreaterThanOrEqual(0)
      expect(n.opacity).toBeLessThanOrEqual(1)
    }
  })

  test('TEXT nodes have fontFamily', () => {
    for (const n of allNodes) {
      if (n.type === 'TEXT') {
        expect(typeof n.fontFamily).toBe('string')
        expect(n.fontFamily.length).toBeGreaterThan(0)
      }
    }
  })

  test('TEXT nodes have valid fontSize', () => {
    for (const n of allNodes) {
      if (n.type === 'TEXT') {
        expect(n.fontSize).toBeGreaterThan(0)
      }
    }
  })

  test('fills have valid colors', () => {
    function checkFill(fill: Fill, nodeName: string) {
      if (fill.type === 'SOLID') {
        const { r, g, b, a } = fill.color
        expect(r).toBeGreaterThanOrEqual(0)
        expect(r).toBeLessThanOrEqual(1)
        expect(g).toBeGreaterThanOrEqual(0)
        expect(g).toBeLessThanOrEqual(1)
        expect(b).toBeGreaterThanOrEqual(0)
        expect(b).toBeLessThanOrEqual(1)
        expect(a).toBeGreaterThanOrEqual(0)
        expect(a).toBeLessThanOrEqual(1)
      }
    }
    for (const n of allNodes) {
      for (const fill of n.fills) {
        checkFill(fill, n.name)
      }
    }
  })

  test('effects have valid radius', () => {
    for (const n of allNodes) {
      for (const e of n.effects) {
        expect(e.radius).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('layout nodes have valid spacing', () => {
    for (const n of allNodes) {
      if (n.layoutMode !== 'NONE') {
        expect(Number.isFinite(n.itemSpacing)).toBe(true)
        expect(n.paddingTop).toBeGreaterThanOrEqual(0)
        expect(n.paddingRight).toBeGreaterThanOrEqual(0)
        expect(n.paddingBottom).toBeGreaterThanOrEqual(0)
        expect(n.paddingLeft).toBeGreaterThanOrEqual(0)
      }
    }
  })

})

heavy('parse heavy .fig files', () => {
  let material3: SceneGraph
  let nuxtui: SceneGraph
  let material3Nodes: SceneNode[]
  let nuxtUiNodes: SceneNode[]

  beforeAll(async () => {
    const m3Buf = readFileSync(resolve(FIXTURES, 'material3.fig'))
    const nuBuf = readFileSync(resolve(FIXTURES, 'nuxtui.fig'))
    material3 = await parseFigFile(m3Buf.buffer as ArrayBuffer)
    nuxtui = await parseFigFile(nuBuf.buffer as ArrayBuffer)
    material3Nodes = collectAllNodes(material3)
    nuxtUiNodes = collectAllNodes(nuxtui)
  })

  test('material3.fig parses with pages and nodes', () => {
    expect(material3).toBeInstanceOf(SceneGraph)
    expect(material3.getPages().length).toBeGreaterThan(0)
    expect(material3Nodes.length).toBeGreaterThan(0)
  })

  test('nuxtui.fig parses with pages and nodes', () => {
    expect(nuxtui).toBeInstanceOf(SceneGraph)
    expect(nuxtui.getPages().length).toBeGreaterThan(0)
    expect(nuxtUiNodes.length).toBeGreaterThan(0)
  })

  test('material3: contains COMPONENT nodes', () => {
    expect(material3Nodes.some((n) => n.type === 'COMPONENT')).toBe(true)
  })

  test('material3: no unmapped node types', () => {
    const invalid = material3Nodes.filter((n) => !VALID_NODE_TYPES.has(n.type))
    expect(invalid.map((n) => `${n.name}: ${n.type}`)).toEqual([])
  })

  test('nuxtui: no unmapped node types', () => {
    const invalid = nuxtUiNodes.filter((n) => !VALID_NODE_TYPES.has(n.type))
    expect(invalid.map((n) => `${n.name}: ${n.type}`)).toEqual([])
  })

  test('material3: fills have valid colors', () => {
    for (const n of material3Nodes) {
      for (const fill of n.fills) {
        if (fill.type === 'SOLID') {
          const { r, g, b, a } = fill.color
          expect(r).toBeGreaterThanOrEqual(0)
          expect(r).toBeLessThanOrEqual(1)
          expect(g).toBeGreaterThanOrEqual(0)
          expect(g).toBeLessThanOrEqual(1)
          expect(b).toBeGreaterThanOrEqual(0)
          expect(b).toBeLessThanOrEqual(1)
          expect(a).toBeGreaterThanOrEqual(0)
          expect(a).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  test('nuxtui: fills have valid colors', () => {
    for (const n of nuxtUiNodes) {
      for (const fill of n.fills) {
        if (fill.type === 'SOLID') {
          expect(fill.color.r).toBeGreaterThanOrEqual(0)
          expect(fill.color.r).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('roundtrip: export → re-import', () => {
  let reImported: SceneGraph
  let reImportedNodes: SceneNode[]

  beforeAll(async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page1 = graph.getPages()[0]
    const page2 = graph.addPage('Second Page')
    const internalPage = graph.addPage('Internal Only Canvas')
    internalPage.internalOnly = true
    graph.createNode('RECTANGLE', internalPage.id, {
      name: 'Internal Rect',
      width: 50,
      height: 50,
    })

    graph.createNode('FRAME', page1.id, {
      name: 'Container',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      layoutMode: 'VERTICAL',
      itemSpacing: 16,
      paddingTop: 24,
      paddingRight: 24,
      paddingBottom: 24,
      paddingLeft: 24,
      cornerRadius: 12,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' }],
    })

    const container = graph.getChildren(page1.id)[0]

    graph.createNode('RECTANGLE', container.id, {
      name: 'Header BG',
      x: 0,
      y: 0,
      width: 400,
      height: 80,
      cornerRadius: 8,
      topLeftRadius: 8,
      topRightRadius: 8,
      bottomRightRadius: 0,
      bottomLeftRadius: 0,
      independentCorners: true,
      fills: [
        { type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' },
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          opacity: 0.5,
          visible: true,
          blendMode: 'NORMAL',
          gradientStops: [
            { color: { r: 1, g: 1, b: 1, a: 1 }, position: 0 },
            { color: { r: 0, g: 0, b: 0, a: 0 }, position: 1 },
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        },
      ],
      effects: [
        { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 4 }, radius: 8, spread: 0, visible: true, blendMode: 'NORMAL' },
      ],
    })

    graph.createNode('TEXT', container.id, {
      name: 'Title',
      x: 24,
      y: 100,
      width: 352,
      height: 24,
      text: 'Hello World',
      fontSize: 18,
      fontFamily: 'Inter',
      fontWeight: 700,
      textAlignHorizontal: 'CENTER',
    })

    graph.createNode('ELLIPSE', container.id, {
      name: 'Circle',
      x: 176,
      y: 140,
      width: 48,
      height: 48,
      fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.1, b: 0.3, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' }],
    })

    graph.createNode('RECTANGLE', page2.id, {
      name: 'Page2 Rect',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    })

    const figBytes = await exportFigFile(graph)
    reImported = await parseFigFile(figBytes.buffer as ArrayBuffer)
    reImportedNodes = collectAllNodes(reImported)
  })

  test('preserves page count', () => {
    expect(reImported.getPages().length).toBe(2)
  })

  test('preserves page names', () => {
    const names = reImported.getPages().map((p) => p.name)
    expect(names).toContain('Page 1')
    expect(names).toContain('Second Page')
  })

  test('preserves internal pages', () => {
    const allPages = reImported.getPages(true)
    const publicPages = reImported.getPages(false)
    expect(allPages.length).toBe(3)
    expect(publicPages.length).toBe(2)
    const internal = allPages.find((p) => p.internalOnly)
    expect(internal).toBeDefined()
    expect(internal!.name).toBe('Internal Only Canvas')
    expect(reImported.getChildren(internal!.id).length).toBe(1)
  })

  test('preserves node count', () => {
    // 1 frame + 1 rect + 1 text + 1 ellipse + 1 rect on page 2 = 5
    expect(reImportedNodes.length).toBe(5)
  })

  test('preserves node types', () => {
    const types = countByType(reImportedNodes)
    expect(types.get('FRAME')).toBe(1)
    expect(types.get('RECTANGLE')).toBe(2)
    expect(types.get('TEXT')).toBe(1)
    expect(types.get('ELLIPSE')).toBe(1)
  })

  test('preserves node names', () => {
    const names = new Set(reImportedNodes.map((n) => n.name))
    expect(names.has('Container')).toBe(true)
    expect(names.has('Header BG')).toBe(true)
    expect(names.has('Title')).toBe(true)
    expect(names.has('Circle')).toBe(true)
    expect(names.has('Page2 Rect')).toBe(true)
  })

  test('preserves fills', () => {
    const headerBg = reImportedNodes.find((n) => n.name === 'Header BG')!
    expect(headerBg.fills).toHaveLength(2)
    expect(headerBg.fills[0].type).toBe('SOLID')
    expect(headerBg.fills[0].color.r).toBeCloseTo(0.2, 1)
    expect(headerBg.fills[1].type).toBe('GRADIENT_LINEAR')
    expect(headerBg.fills[1].opacity).toBeCloseTo(0.5, 1)
    expect(headerBg.fills[1].gradientStops).toHaveLength(2)
  })

  test('preserves text content', () => {
    const title = reImportedNodes.find((n) => n.name === 'Title')!
    expect(title.text).toBe('Hello World')
  })

  test('preserves text properties', () => {
    const title = reImportedNodes.find((n) => n.name === 'Title')!
    expect(title.fontSize).toBe(18)
    expect(title.fontFamily).toBe('Inter')
    expect(title.fontWeight).toBe(700)
    expect(title.textAlignHorizontal).toBe('CENTER')
  })

  test('preserves layout mode', () => {
    const container = reImportedNodes.find((n) => n.name === 'Container')!
    expect(container.layoutMode).toBe('VERTICAL')
  })

  test('preserves layout spacing', () => {
    const container = reImportedNodes.find((n) => n.name === 'Container')!
    expect(container.itemSpacing).toBe(16)
    expect(container.paddingTop).toBe(24)
    expect(container.paddingRight).toBe(24)
    expect(container.paddingBottom).toBe(24)
    expect(container.paddingLeft).toBe(24)
  })

  test('preserves corner radius', () => {
    const container = reImportedNodes.find((n) => n.name === 'Container')!
    expect(container.cornerRadius).toBe(12)
  })

  test('preserves independent corner radii', () => {
    const headerBg = reImportedNodes.find((n) => n.name === 'Header BG')!
    expect(headerBg.independentCorners).toBe(true)
    expect(headerBg.topLeftRadius).toBe(8)
    expect(headerBg.topRightRadius).toBe(8)
    expect(headerBg.bottomRightRadius).toBe(0)
    expect(headerBg.bottomLeftRadius).toBe(0)
  })

  test('preserves effects', () => {
    const headerBg = reImportedNodes.find((n) => n.name === 'Header BG')!
    expect(headerBg.effects).toHaveLength(1)
    expect(headerBg.effects[0].type).toBe('DROP_SHADOW')
    expect(headerBg.effects[0].radius).toBe(8)
    expect(headerBg.effects[0].offset.y).toBe(4)
  })

  test('preserves dimensions', () => {
    const container = reImportedNodes.find((n) => n.name === 'Container')!
    expect(container.width).toBe(400)
    expect(container.height).toBe(300)
  })
})

describe('edge cases', () => {
  test('non-fig-kiwi bytes throw meaningful error', async () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    await expect(parseFigFile(garbage.buffer as ArrayBuffer)).rejects.toThrow()
  })

  test('invalid zip data throws', async () => {
    const garbage = new Uint8Array(50).fill(0xff)
    await expect(parseFigFile(garbage.buffer as ArrayBuffer)).rejects.toThrow()
  })

  test('REMOVED nodes are skipped', async () => {
    const { importNodeChanges } = await import('../../packages/core/src/kiwi/fig-import')
    const graph = importNodeChanges([
      {
        guid: { sessionID: 0, localID: 0 },
        type: 'DOCUMENT',
        name: 'Document',
        visible: true,
        opacity: 1,
        phase: 'CREATED',
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page',
        visible: true,
        opacity: 1,
        phase: 'CREATED',
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      },
      {
        guid: { sessionID: 1, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Visible',
        visible: true,
        opacity: 1,
        phase: 'CREATED',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      },
      {
        guid: { sessionID: 1, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'RECTANGLE',
        name: 'Deleted',
        visible: true,
        opacity: 1,
        phase: 'REMOVED',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      },
    ])
    const children = graph.getChildren(graph.getPages()[0].id)
    expect(children).toHaveLength(1)
    expect(children[0].name).toBe('Visible')
  })

  test('symbolOverrides propagate through nested instances', () => {
    // Structure:
    //   DOCUMENT (0:0)
    //   └─ CANVAS "Page" (0:1)
    //       ├─ COMPONENT "Inner" (1:1)    ← inner component
    //       │   └─ TEXT "Label" (1:2)     ← default text "Default"
    //       ├─ COMPONENT "Outer" (1:3)    ← outer component
    //       │   └─ INSTANCE "InnerUse" (1:4) symId=1:1, override: Label→"Changed"
    //       └─ INSTANCE "OuterUse" (1:5)  ← instance of Outer
    //
    // After import, OuterUse should contain a clone of InnerUse,
    // which should contain a Label text with "Changed" (not "Default")
    const graph = importNodeChanges([
      {
        guid: { sessionID: 0, localID: 0 },
        type: 'DOCUMENT',
        name: 'Document',
        phase: 'CREATED',
      } as NodeChange,
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page',
        phase: 'CREATED',
      } as NodeChange,
      // Inner component
      {
        guid: { sessionID: 1, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'SYMBOL',
        name: 'Inner',
        phase: 'CREATED',
        size: { x: 100, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      } as NodeChange,
      // TEXT child of Inner
      {
        guid: { sessionID: 1, localID: 2 },
        overrideKey: { sessionID: 99, localID: 2 },
        parentIndex: { guid: { sessionID: 1, localID: 1 }, position: '!' },
        type: 'TEXT',
        name: 'Label',
        textData: { characters: 'Default' },
        phase: 'CREATED',
        size: { x: 80, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      } as NodeChange,
      // Outer component
      {
        guid: { sessionID: 1, localID: 3 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'SYMBOL',
        name: 'Outer',
        phase: 'CREATED',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      } as NodeChange,
      // INSTANCE of Inner inside Outer, with symbolOverride on Label
      {
        guid: { sessionID: 1, localID: 4 },
        parentIndex: { guid: { sessionID: 1, localID: 3 }, position: '!' },
        type: 'INSTANCE',
        name: 'InnerUse',
        phase: 'CREATED',
        size: { x: 100, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        symbolData: {
          symbolID: { sessionID: 1, localID: 1 },
          symbolOverrides: [
            {
              guidPath: { guids: [{ sessionID: 99, localID: 2 }] },
              textData: { characters: 'Changed' },
            },
          ],
        },
      } as NodeChange,
      // Top-level INSTANCE of Outer on the page
      {
        guid: { sessionID: 1, localID: 5 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'INSTANCE',
        name: 'OuterUse',
        phase: 'CREATED',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        symbolData: {
          symbolID: { sessionID: 1, localID: 3 },
        },
      } as NodeChange,
    ])

    const page = graph.getPages()[0]
    const outerUse = graph.getChildren(page.id).find((n) => n.name === 'OuterUse')
    expect(outerUse).toBeDefined()
    expect(outerUse!.type).toBe('INSTANCE')

    // Walk down: OuterUse > InnerUse clone > Label clone
    const innerClone = graph.getChildren(outerUse!.id)[0]
    expect(innerClone).toBeDefined()
    expect(innerClone.name).toBe('InnerUse')

    const labelClone = graph.getChildren(innerClone.id)[0]
    expect(labelClone).toBeDefined()
    expect(labelClone.name).toBe('Label')
    expect(labelClone.text).toBe('Changed')
  })

  test('overriddenSymbolID swaps instance component through nested levels', () => {
    // Structure:
    //   COMPONENT "IconA" (1:1) → VECTOR "PathA"
    //   COMPONENT "IconB" (1:3) → VECTOR "PathB1", VECTOR "PathB2"
    //   COMPONENT "Button" (1:5) → INSTANCE "icon" of IconA
    //   COMPONENT "Toolbar" (1:7) → INSTANCE "btn" of Button, with override swapping icon to IconB
    //   INSTANCE "ToolbarUse" (1:9) of Toolbar on the page
    //
    // After import, ToolbarUse > btn clone > icon clone should have IconB's children
    const graph = importNodeChanges([
      {
        guid: { sessionID: 0, localID: 0 },
        type: 'DOCUMENT',
        name: 'Document',
        phase: 'CREATED',
      } as NodeChange,
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page',
        phase: 'CREATED',
      } as NodeChange,
      // IconA component with 1 child
      {
        guid: { sessionID: 1, localID: 1 },
        overrideKey: { sessionID: 90, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'SYMBOL',
        name: 'IconA',
        phase: 'CREATED',
        size: { x: 24, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      } as NodeChange,
      {
        guid: { sessionID: 1, localID: 2 },
        overrideKey: { sessionID: 90, localID: 2 },
        parentIndex: { guid: { sessionID: 1, localID: 1 }, position: '!' },
        type: 'VECTOR',
        name: 'PathA',
        phase: 'CREATED',
        size: { x: 24, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      } as NodeChange,
      // IconB component with 2 children
      {
        guid: { sessionID: 1, localID: 3 },
        overrideKey: { sessionID: 90, localID: 3 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'SYMBOL',
        name: 'IconB',
        phase: 'CREATED',
        size: { x: 24, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      } as NodeChange,
      {
        guid: { sessionID: 1, localID: 31 },
        overrideKey: { sessionID: 90, localID: 31 },
        parentIndex: { guid: { sessionID: 1, localID: 3 }, position: '!' },
        type: 'VECTOR',
        name: 'PathB1',
        phase: 'CREATED',
        size: { x: 24, y: 12 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      } as NodeChange,
      {
        guid: { sessionID: 1, localID: 32 },
        overrideKey: { sessionID: 90, localID: 32 },
        parentIndex: { guid: { sessionID: 1, localID: 3 }, position: '"' },
        type: 'VECTOR',
        name: 'PathB2',
        phase: 'CREATED',
        size: { x: 24, y: 12 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      } as NodeChange,
      // Button component with instance of IconA
      {
        guid: { sessionID: 1, localID: 5 },
        overrideKey: { sessionID: 90, localID: 5 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'SYMBOL',
        name: 'Button',
        phase: 'CREATED',
        size: { x: 40, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      } as NodeChange,
      {
        guid: { sessionID: 1, localID: 6 },
        overrideKey: { sessionID: 90, localID: 6 },
        parentIndex: { guid: { sessionID: 1, localID: 5 }, position: '!' },
        type: 'INSTANCE',
        name: 'icon',
        phase: 'CREATED',
        size: { x: 24, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        symbolData: { symbolID: { sessionID: 1, localID: 1 } },
      } as NodeChange,
      // Toolbar component with instance of Button, swapping icon to IconB
      {
        guid: { sessionID: 1, localID: 7 },
        overrideKey: { sessionID: 90, localID: 7 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '$' },
        type: 'SYMBOL',
        name: 'Toolbar',
        phase: 'CREATED',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      } as NodeChange,
      {
        guid: { sessionID: 1, localID: 8 },
        overrideKey: { sessionID: 90, localID: 8 },
        parentIndex: { guid: { sessionID: 1, localID: 7 }, position: '!' },
        type: 'INSTANCE',
        name: 'btn',
        phase: 'CREATED',
        size: { x: 40, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        symbolData: {
          symbolID: { sessionID: 1, localID: 5 },
          symbolOverrides: [
            {
              guidPath: { guids: [{ sessionID: 90, localID: 6 }] },
              overriddenSymbolID: { sessionID: 1, localID: 3 },
            },
          ],
        },
      } as NodeChange,
      // Page-level instance of Toolbar
      {
        guid: { sessionID: 1, localID: 9 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '%' },
        type: 'INSTANCE',
        name: 'ToolbarUse',
        phase: 'CREATED',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        symbolData: {
          symbolID: { sessionID: 1, localID: 7 },
        },
      } as NodeChange,
    ])

    const page = graph.getPages()[0]
    const toolbarUse = graph.getChildren(page.id).find((n) => n.name === 'ToolbarUse')
    expect(toolbarUse).toBeDefined()

    // ToolbarUse > btn clone > icon clone
    const btnClone = graph.getChildren(toolbarUse?.id ?? '')[0]
    expect(btnClone).toBeDefined()
    expect(btnClone.name).toBe('btn')

    const iconClone = graph.getChildren(btnClone.id)[0]
    expect(iconClone).toBeDefined()
    expect(iconClone.name).toBe('icon')

    // Icon should have IconB's 2 children, not IconA's 1 child
    const iconChildren = graph.getChildren(iconClone.id)
    expect(iconChildren).toHaveLength(2)
    expect(iconChildren.map((c) => c.name).sort()).toEqual(['PathB1', 'PathB2'])
  })

  test('DSD propagates through intermediate clones that are also DSD-targeted', async () => {
    const graph = await parseFigFile(readFileSync(resolve(__dirname, '../fixtures/gold-preview.fig')).buffer)

    const thumb = [...graph.getAllNodes()].find((n) => n.name === 'Preview Thumbnail')
    expect(thumb).toBeDefined()

    let overflows = 0
    function walk(id: string) {
      const node = graph.getNode(id)
      if (!node) return
      if (node.type === 'VECTOR') {
        const parent = graph.getNode(node.parentId)
        if (parent?.type === 'INSTANCE' && parent.width > 0 && parent.height > 0) {
          // Check visibility
          let vis = true
          let cur: typeof node | null = node
          while (cur) {
            if (!cur.visible) {
              vis = false
              break
            }
            cur = cur.parentId ? graph.getNode(cur.parentId) ?? null : null
          }
          // Check clipping
          let clipped = false
          cur = graph.getNode(parent.parentId)
          while (cur) {
            if (cur.clipsContent) {
              clipped = true
              break
            }
            cur = cur.parentId ? graph.getNode(cur.parentId) ?? null : null
          }
          if (vis && !clipped && node.width > parent.width * 1.2) {
            overflows++
          }
        }
      }
      for (const cid of node.childIds) walk(cid)
    }
    walk(thumb?.id ?? '')
    expect(overflows).toBe(0)
  })
})

describe('text node export', () => {
  test('text nodes have derivedTextData and textUserLayoutVersion', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('TEXT', page.id, {
      name: 'Greeting',
      text: 'Hello World',
      width: 120,
      height: 24,
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const textNode = [...reimported.getAllNodes()].find((n) => n.name === 'Greeting')!
    expect(textNode).toBeDefined()
    expect(textNode.type).toBe('TEXT')
    expect(textNode.text).toBe('Hello World')
    expect(textNode.fontFamily).toBe('Inter')
    expect(textNode.fontSize).toBe(16)
  })

  test('text node has lines in textData', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('TEXT', page.id, {
      name: 'Multiline',
      text: 'Line 1\nLine 2\nLine 3',
      width: 100,
      height: 60,
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 14
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const textNode = [...reimported.getAllNodes()].find((n) => n.name === 'Multiline')!
    expect(textNode).toBeDefined()
    expect(textNode.text).toBe('Line 1\nLine 2\nLine 3')
  })

  test('derivedTextData fields present in raw binary', async () => {
    await initCodec()

    const { unzipSync, inflateSync } = await import('fflate')
    const { decodeBinarySchema, compileSchema, ByteBuffer } = await import(
      '../../packages/core/src/kiwi/kiwi-schema'
    )
    const { parseFigKiwiChunks } = await import('@open-pencil/core')

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('TEXT', page.id, {
      name: 'Raw Test',
      text: 'Check binary',
      width: 80,
      height: 18,
      fontFamily: 'Roboto',
      fontWeight: 700,
      fontSize: 12
    })

    const exported = await exportFigFile(graph)
    const zip = unzipSync(new Uint8Array(exported))
    const canvasData = zip['canvas.fig'] ?? zip['canvas']
    expect(canvasData).toBeDefined()

    const chunks = parseFigKiwiChunks(canvasData)
    expect(chunks).not.toBeNull()
    expect(chunks!.length).toBeGreaterThanOrEqual(2)

    const schemaBytes = inflateSync(chunks![0])
    const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    const compiled = compileSchema(schema) as { decodeMessage(data: Uint8Array): any }
    const dataRaw = inflateSync(chunks![1])
    const message = compiled.decodeMessage(dataRaw)

    const textNc = message.nodeChanges.find((nc: any) => nc.type === 'TEXT')
    expect(textNc).toBeDefined()

    expect(textNc.textData.characters).toBe('Check binary')
    expect(textNc.textData.lines).toBeDefined()
    expect(textNc.textData.lines.length).toBeGreaterThanOrEqual(1)
    expect(textNc.textData.lines[0].lineType).toBe('PLAIN')

    expect(textNc.textUserLayoutVersion).toBe(4)

    expect(textNc.derivedTextData).toBeDefined()
    expect(textNc.derivedTextData.layoutSize).toBeDefined()
    expect(textNc.derivedTextData.layoutSize.x).toBe(80)
    expect(textNc.derivedTextData.layoutSize.y).toBe(18)

    expect(textNc.derivedTextData.fontMetaData).toBeDefined()
    expect(textNc.derivedTextData.fontMetaData.length).toBe(1)
    expect(textNc.derivedTextData.fontMetaData[0].key.family).toBe('Roboto')
    expect(textNc.derivedTextData.fontMetaData[0].fontWeight).toBe(700)
    expect(textNc.derivedTextData.fontMetaData[0].fontStyle).toBe('NORMAL')
  })

  test('style runs produce multiple fontMetaData entries', async () => {
    await initCodec()

    const { unzipSync, inflateSync } = await import('fflate')
    const { decodeBinarySchema, compileSchema, ByteBuffer } = await import(
      '../../packages/core/src/kiwi/kiwi-schema'
    )
    const { parseFigKiwiChunks } = await import('@open-pencil/core')

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('TEXT', page.id, {
      name: 'Styled',
      text: 'Bold and Normal',
      width: 150,
      height: 20,
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16,
      styleRuns: [
        { start: 0, length: 4, style: { fontWeight: 700 } },
        { start: 5, length: 10, style: {} }
      ]
    })

    const exported = await exportFigFile(graph)
    const zip = unzipSync(new Uint8Array(exported))
    const canvasData = zip['canvas.fig'] ?? zip['canvas']
    const chunks = parseFigKiwiChunks(canvasData)!
    const schemaBytes = inflateSync(chunks[0])
    const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    const compiled = compileSchema(schema) as { decodeMessage(data: Uint8Array): any }
    const dataRaw = inflateSync(chunks[1])
    const message = compiled.decodeMessage(dataRaw)

    const textNc = message.nodeChanges.find((nc: any) => nc.type === 'TEXT')
    expect(textNc.derivedTextData.fontMetaData.length).toBe(2)

    const families = textNc.derivedTextData.fontMetaData.map((m: any) => m.key.style)
    expect(families).toContain('Bold')
    expect(families).toContain('Regular')
  })

  test('material3.fig text nodes have derivedTextData after round-trip', async () => {
    const buf = readFileSync(resolve(FIXTURES, 'material3.fig'))
    const original = await parseFigFile(buf.buffer as ArrayBuffer)

    const textNodes = [...original.getAllNodes()].filter((n) => n.type === 'TEXT')
    expect(textNodes.length).toBeGreaterThan(0)

    const exported = await exportFigFile(original)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const reimportedText = [...reimported.getAllNodes()].filter((n) => n.type === 'TEXT')
    expect(reimportedText.length).toBe(textNodes.length)

    for (const node of reimportedText.slice(0, 10)) {
      expect(node.text.length).toBeGreaterThan(0)
    }
  })
})

describe('variable roundtrip', () => {
  test('variables and collections survive export → re-import', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const col = graph.createCollection('Design Tokens')
    graph.createVariable('color/primary', 'COLOR', col.id, { r: 0.23, g: 0.51, b: 0.96, a: 1 })
    graph.createVariable('spacing/base', 'FLOAT', col.id, 8)
    graph.createVariable('visible', 'BOOLEAN', col.id, true)
    graph.createVariable('label', 'STRING', col.id, 'Hello')

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    expect(reimported.variables.size).toBe(4)
    expect(reimported.variableCollections.size).toBe(1)

    const reimportedCol = [...reimported.variableCollections.values()][0]
    expect(reimportedCol.name).toBe('Design Tokens')
    expect(reimportedCol.variableIds).toHaveLength(4)

    const vars = [...reimported.variables.values()]
    const colorVar = vars.find((v) => v.name === 'color/primary')!
    expect(colorVar.type).toBe('COLOR')
    const colorVal = Object.values(colorVar.valuesByMode)[0] as { r: number; g: number; b: number; a: number }
    expect(colorVal.r).toBeCloseTo(0.23, 1)

    const floatVar = vars.find((v) => v.name === 'spacing/base')!
    expect(floatVar.type).toBe('FLOAT')
    expect(Object.values(floatVar.valuesByMode)[0]).toBe(8)

    const boolVar = vars.find((v) => v.name === 'visible')!
    expect(boolVar.type).toBe('BOOLEAN')
    expect(Object.values(boolVar.valuesByMode)[0]).toBe(true)

    const strVar = vars.find((v) => v.name === 'label')!
    expect(strVar.type).toBe('STRING')
    expect(Object.values(strVar.valuesByMode)[0]).toBe('Hello')
  })

  test('variable bindings survive export → re-import', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const col = graph.createCollection('Tokens')
    const floatVar = graph.createVariable('radius', 'FLOAT', col.id, 12)

    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Bound Rect',
      width: 100,
      height: 100,
      cornerRadius: 12,
    })
    graph.bindVariable(rect.id, 'cornerRadius', floatVar.id)

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const reimportedRect = [...reimported.getAllNodes()].find((n) => n.name === 'Bound Rect')!
    expect(reimportedRect).toBeDefined()
    expect(Object.keys(reimportedRect.boundVariables)).toContain('cornerRadius')
  })

  test('material3.fig variables survive round-trip', async () => {
    const buf = readFileSync(resolve(FIXTURES, 'material3.fig'))
    const original = await parseFigFile(buf.buffer as ArrayBuffer)

    const exported = await exportFigFile(original)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    expect(reimported.variables.size).toBe(original.variables.size)
    expect(reimported.variableCollections.size).toBeGreaterThanOrEqual(
      [...original.variableCollections.values()].filter((c) => c.variableIds.length > 0).length
    )
  })
})
