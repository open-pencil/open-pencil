import { describe, test, expect, beforeAll } from 'bun:test'

import {
  SceneGraph,
  sceneNodeToKiwi,
  exportFigFile,
  parseFigFile,
  initCodec,
} from '@open-pencil/core'

beforeAll(async () => {
  await initCodec()
})

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

const ROOT_GUID = { sessionID: 1, localID: 0 }

function toKiwi(node: ReturnType<SceneGraph['createNode']>, graph: SceneGraph) {
  const blobs: Uint8Array[] = []
  return sceneNodeToKiwi(node, ROOT_GUID, 0, { value: 100 }, graph, blobs)
}

// ---------------------------------------------------------------------------
// Fix 1 — Auto-layout children get (0,0) transforms
// ---------------------------------------------------------------------------

describe('Fix 1: auto-layout child transforms', () => {
  test('auto-layout child gets zero transform regardless of its x/y', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), {
      name: 'AutoLayout',
      x: 0,
      y: 0,
      width: 300,
      height: 400,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      paddingTop: 16,
      paddingLeft: 16,
      paddingBottom: 16,
      paddingRight: 16,
    })

    const child = graph.createNode('FRAME', parent.id, {
      name: 'Child',
      x: 50,
      y: 100,
      width: 200,
      height: 60,
    })

    const blobs: Uint8Array[] = []
    // Serialize the parent — children are serialized recursively
    const changes = sceneNodeToKiwi(
      graph.getNode(parent.id)!,
      ROOT_GUID,
      0,
      { value: 100 },
      graph,
      blobs
    ) as Record<string, any>[]

    // changes[0] = parent, changes[1] = child
    const childNc = changes.find((nc) => nc.name === 'Child')!
    expect(childNc).toBeDefined()
    expect(childNc.transform.m02).toBe(0)
    expect(childNc.transform.m12).toBe(0)
  })

  test('absolute-positioned child inside auto-layout keeps its real x/y', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), {
      name: 'AutoLayout',
      x: 0,
      y: 0,
      width: 300,
      height: 400,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
    })

    const absChild = graph.createNode('FRAME', parent.id, {
      name: 'AbsChild',
      x: 75,
      y: 120,
      width: 50,
      height: 50,
      layoutPositioning: 'ABSOLUTE',
    })

    const blobs: Uint8Array[] = []
    const changes = sceneNodeToKiwi(
      graph.getNode(parent.id)!,
      ROOT_GUID,
      0,
      { value: 100 },
      graph,
      blobs
    ) as Record<string, any>[]

    const absNc = changes.find((nc) => nc.name === 'AbsChild')!
    expect(absNc).toBeDefined()
    expect(absNc.transform.m02).toBe(75)
    expect(absNc.transform.m12).toBe(120)
  })

  test('child in non-auto-layout parent keeps its real x/y', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), {
      name: 'PlainFrame',
      x: 0,
      y: 0,
      width: 300,
      height: 400,
      // layoutMode defaults to 'NONE'
    })

    const child = graph.createNode('FRAME', parent.id, {
      name: 'Child',
      x: 30,
      y: 45,
      width: 100,
      height: 80,
    })

    const blobs: Uint8Array[] = []
    const changes = sceneNodeToKiwi(
      graph.getNode(parent.id)!,
      ROOT_GUID,
      0,
      { value: 100 },
      graph,
      blobs
    ) as Record<string, any>[]

    const childNc = changes.find((nc) => nc.name === 'Child')!
    expect(childNc).toBeDefined()
    expect(childNc.transform.m02).toBe(30)
    expect(childNc.transform.m12).toBe(45)
  })

  test('horizontal auto-layout child also gets zero transform', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), {
      name: 'HorizontalLayout',
      x: 0,
      y: 0,
      width: 600,
      height: 100,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 12,
    })

    graph.createNode('RECTANGLE', parent.id, {
      name: 'Item',
      x: 200,
      y: 50,
      width: 80,
      height: 80,
    })

    const blobs: Uint8Array[] = []
    const changes = sceneNodeToKiwi(
      graph.getNode(parent.id)!,
      ROOT_GUID,
      0,
      { value: 100 },
      graph,
      blobs
    ) as Record<string, any>[]

    const itemNc = changes.find((nc) => nc.name === 'Item')!
    expect(itemNc.transform.m02).toBe(0)
    expect(itemNc.transform.m12).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Fix 2 — frameMaskDisabled always true
// ---------------------------------------------------------------------------

describe('Fix 2: frameMaskDisabled is inverse of clipsContent', () => {
  test('FRAME without clipsContent gets frameMaskDisabled=true', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'Frame',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    })

    const changes = toKiwi(node, graph) as Record<string, any>[]
    expect(changes[0].frameMaskDisabled).toBe(true)
  })

  test('FRAME with clipsContent=true gets frameMaskDisabled=false', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'Clipping',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      clipsContent: true,
    })

    const changes = toKiwi(node, graph) as Record<string, any>[]
    expect(changes[0].frameMaskDisabled).toBe(false)
  })

  test('FRAME with clipsContent=false gets frameMaskDisabled=true', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'NoClip',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      clipsContent: false,
    })

    const changes = toKiwi(node, graph) as Record<string, any>[]
    expect(changes[0].frameMaskDisabled).toBe(true)
  })

  test('clipsContent roundtrips through export/parse', async () => {
    const graph = new SceneGraph()
    graph.createNode('FRAME', pageId(graph), {
      name: 'ClipFrame',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      clipsContent: true,
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const frame = [...reimported.nodes.values()].find((n) => n.name === 'ClipFrame')!
    expect(frame.clipsContent).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Fix 3 — bordersTakeSpace writes strokesIncludedInLayout
// ---------------------------------------------------------------------------

describe('Fix 3: bordersTakeSpace serialization', () => {
  test('auto-layout frame with strokesIncludedInLayout=true gets bordersTakeSpace=true', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'LayoutWithBorders',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      strokesIncludedInLayout: true,
    })

    const changes = toKiwi(node, graph) as Record<string, any>[]
    expect(changes[0].bordersTakeSpace).toBe(true)
  })

  test('auto-layout frame with strokesIncludedInLayout=false gets bordersTakeSpace=false', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'LayoutNoBorders',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      strokesIncludedInLayout: false,
    })

    const changes = toKiwi(node, graph) as Record<string, any>[]
    expect(changes[0].bordersTakeSpace).toBe(false)
  })

  test('non-auto-layout frame does not get bordersTakeSpace', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'PlainFrame',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      strokesIncludedInLayout: true,
    })

    const changes = toKiwi(node, graph) as Record<string, any>[]
    expect(changes[0].bordersTakeSpace).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Fix 4 — lineHeight always written on text nodes
// ---------------------------------------------------------------------------

describe('Fix 4: text lineHeight serialization', () => {
  test('text node with explicit lineHeight uses that value', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'ExplicitLH',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16,
      lineHeight: 24,
    })

    const changes = toKiwi(node, graph) as Record<string, any>[]
    expect(changes[0].lineHeight).toEqual({ value: 24, units: 'PIXELS' })
  })

  test('text node without lineHeight defaults to ceil(fontSize * 1.2)', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'DefaultLH',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16,
      // lineHeight not set — defaults to null
    })

    const changes = toKiwi(node, graph) as Record<string, any>[]
    // ceil(16 * 1.2) = ceil(19.2) = 20
    expect(changes[0].lineHeight).toEqual({ value: 20, units: 'PIXELS' })
  })

  test('lineHeight default for odd fontSize', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'OddSize',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 14,
    })

    const changes = toKiwi(node, graph) as Record<string, any>[]
    // ceil(14 * 1.2) = ceil(16.8) = 17
    expect(changes[0].lineHeight).toEqual({ value: 17, units: 'PIXELS' })
  })

  test('lineHeight survives roundtrip through export/parse', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'Roundtrip',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16,
      lineHeight: 28,
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const textNode = [...reimported.nodes.values()].find((n) => n.type === 'TEXT')!
    expect(textNode.lineHeight).toBe(28)
  })
})

// ---------------------------------------------------------------------------
// Fix 5 — Font family normalization in derivedTextData
// ---------------------------------------------------------------------------

describe('Fix 5: font family normalization in derivedTextData', () => {
  test('optical size suffix stripped in roundtrip', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'OpticalSize',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'DM Sans 9pt',
      fontWeight: 400,
      fontSize: 14,
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const textNode = [...reimported.nodes.values()].find((n) => n.type === 'TEXT')!
    expect(textNode.fontFamily).toBe('DM Sans')
  })

  test('Variable suffix stripped in roundtrip', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'Variable',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Roboto Variable',
      fontWeight: 700,
      fontSize: 14,
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const textNode = [...reimported.nodes.values()].find((n) => n.type === 'TEXT')!
    expect(textNode.fontFamily).toBe('Roboto')
  })

  test('normal font family preserved unchanged', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'Normal',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 14,
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const textNode = [...reimported.nodes.values()].find((n) => n.type === 'TEXT')!
    expect(textNode.fontFamily).toBe('Inter')
  })

  test('fontName in kiwi output uses normalized family', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'KiwiFontName',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'DM Sans 18px',
      fontWeight: 400,
      fontSize: 14,
    })

    const changes = toKiwi(node, graph) as Record<string, any>[]
    expect(changes[0].fontName.family).toBe('DM Sans')
  })
})

// ---------------------------------------------------------------------------
// Integration: all fixes together in a realistic auto-layout component
// ---------------------------------------------------------------------------

describe('Integration: auto-layout component with all fixes', () => {
  test('full component roundtrip preserves layout structure', async () => {
    const graph = new SceneGraph()

    // Parent auto-layout frame (like a card component)
    const card = graph.createNode('FRAME', pageId(graph), {
      name: 'StatCard',
      x: 100,
      y: 100,
      width: 328,
      height: 200,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      paddingTop: 16,
      paddingLeft: 16,
      paddingBottom: 16,
      paddingRight: 16,
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      clipsContent: true,
      strokesIncludedInLayout: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
    })

    // Title text
    graph.createNode('TEXT', card.id, {
      name: 'Title',
      x: 16,
      y: 16,
      width: 296,
      height: 20,
      text: 'Total Active Users',
      fontFamily: 'DM Sans 9pt',
      fontWeight: 600,
      fontSize: 14,
      lineHeight: 20,
    })

    // Value text
    graph.createNode('TEXT', card.id, {
      name: 'Value',
      x: 16,
      y: 44,
      width: 296,
      height: 40,
      text: '12,345',
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 32,
      lineHeight: 40,
    })

    // Verify kiwi output directly
    const blobs: Uint8Array[] = []
    const changes = sceneNodeToKiwi(
      graph.getNode(card.id)!,
      ROOT_GUID,
      0,
      { value: 100 },
      graph,
      blobs
    ) as Record<string, any>[]

    const cardNc = changes[0]
    const titleNc = changes.find((nc) => nc.name === 'Title')!
    const valueNc = changes.find((nc) => nc.name === 'Value')!

    // Fix 1: children have zero transforms
    expect(titleNc.transform.m02).toBe(0)
    expect(titleNc.transform.m12).toBe(0)
    expect(valueNc.transform.m02).toBe(0)
    expect(valueNc.transform.m12).toBe(0)

    // Fix 2: frameMaskDisabled is inverse of clipsContent
    expect(cardNc.frameMaskDisabled).toBe(false) // clipsContent=true → frameMaskDisabled=false
    expect(titleNc.frameMaskDisabled).toBe(true)  // text nodes don't clip

    // Fix 3: bordersTakeSpace
    expect(cardNc.bordersTakeSpace).toBe(true)

    // Fix 4: lineHeight on text nodes
    expect(titleNc.lineHeight).toEqual({ value: 20, units: 'PIXELS' })
    expect(valueNc.lineHeight).toEqual({ value: 40, units: 'PIXELS' })

    // Fix 5: font family normalized
    expect(titleNc.fontName.family).toBe('DM Sans')
    expect(valueNc.fontName.family).toBe('Inter')

    // Roundtrip through export/parse
    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const nodes = [...reimported.nodes.values()]
    const cardNode = nodes.find((n) => n.name === 'StatCard')!
    const titleNode = nodes.find((n) => n.name === 'Title')!

    expect(cardNode.layoutMode).toBe('VERTICAL')
    expect(cardNode.clipsContent).toBe(true)
    expect(titleNode.fontFamily).toBe('DM Sans')
    expect(titleNode.lineHeight).toBe(20)
  })
})
