import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@inkly/core'
import { guidToString } from '@inkly/core/kiwi/fig/node-change/convert'
import { parseFigBuffer } from '@inkly/core/kiwi/fig/parse/core'

function decodeExport(bytes: Uint8Array) {
  return parseFigBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}

describe('fig roundtrip source metadata', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('preserves imported document, canvas, and sibling ordering metadata', async () => {
    const graph = new SceneGraph()
    const root = graph.getNode(graph.rootId)
    const page = graph.getPages()[0]

    expect(root).toBeDefined()
    if (!root) return

    root.source.format = 'fig'
    root.source.fig.rawNodeFields.strokeJoin = 'BEVEL'
    root.source.fig.rawNodeFields.strokeWeight = 0

    page.source.format = 'fig'
    page.source.id = '4:463'
    page.source.orderKey = '~"'
    page.source.fig.rawNodeFields.backgroundColor = {
      r: 0.9750000238418579,
      g: 0.9750000238418579,
      b: 0.9750000238418579,
      a: 1
    }
    page.source.fig.rawNodeFields.backgroundPaints = [
      {
        type: 'SOLID',
        color: { r: 0.5, g: 0.75, b: 1, a: 1 },
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]
    page.source.fig.rawNodeFields.guides = [
      { axis: 'X', offset: 42 },
      { axis: 'Y', offset: 84 }
    ]
    page.source.fig.rawNodeFields.strokeJoin = 'BEVEL'
    page.source.fig.rawNodeFields.strokeWeight = 0

    const first = graph.createNode('COMPONENT', page.id, { name: 'icon/accessibility' })
    first.source.format = 'fig'
    first.source.id = '4:4812'
    first.source.orderKey = '~~~~~~~~~~1'

    const second = graph.createNode('COMPONENT', page.id, { name: 'icon/align-center' })
    second.source.format = 'fig'
    second.source.id = '4:4813'
    second.source.orderKey = '~~~~~~~~~~3'

    const decoded = decodeExport(await exportFigFile(graph))
    const changes = new Map(
      decoded.nodeChanges
        .filter((nodeChange) => nodeChange.guid)
        .map((nodeChange) => [guidToString(nodeChange.guid), nodeChange])
    )

    expect(changes.get('0:0')?.strokeJoin).toBe('BEVEL')
    expect(changes.get('0:0')?.strokeWeight).toBe(0)

    const canvas = changes.get('4:463')
    expect(canvas?.parentIndex?.position).toBe('~"')
    expect(canvas?.strokeJoin).toBe('BEVEL')
    expect(canvas?.strokeWeight).toBe(0)
    expect(canvas?.backgroundColor).toEqual(page.source.fig.rawNodeFields.backgroundColor)
    expect(canvas?.backgroundPaints).toEqual(page.source.fig.rawNodeFields.backgroundPaints)
    expect(canvas?.guides).toEqual(page.source.fig.rawNodeFields.guides)

    expect(changes.get('4:4812')?.parentIndex?.position).toBe('~~~~~~~~~~1')
    expect(changes.get('4:4813')?.parentIndex?.position).toBe('~~~~~~~~~~3')
  })

  test('edited imported nodes export current geometry and paints', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Edited imported rect',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 1, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })
    rect.source.format = 'fig'
    rect.source.id = '4:500'
    rect.source.fig.rawSize = { x: 80, y: 40 }
    rect.source.fig.rawTransform = { m00: 1, m01: 0, m02: 1, m10: 0, m11: 1, m12: 2 }
    rect.source.fig.rawNodeFields.fillPaints = [
      {
        type: 'SOLID',
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]

    graph.updateNode(rect.id, {
      x: 30,
      width: 120,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 1, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })

    const reimported = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const exportedRect = [...reimported.getAllNodes()].find((node) => node.name === rect.name)

    expect(exportedRect?.x).toBe(30)
    expect(exportedRect?.width).toBe(120)
    expect(exportedRect?.fills[0]?.type).toBe('SOLID')
    if (exportedRect?.fills[0]?.type === 'SOLID') {
      expect(exportedRect.fills[0].color).toEqual({ r: 0, g: 1, b: 0, a: 1 })
    }
  })

  test('preserves imported rich text schema metadata for round-trip', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      name: 'Rich text metadata',
      text: 'Decorated',
      textDecoration: 'UNDERLINE'
    })
    text.source.format = 'fig'
    text.source.id = '4:502'
    text.source.fig.rawNodeFields.leadingTrim = 'CAP_HEIGHT'
    text.source.fig.rawNodeFields.textDecorationStyle = 'WAVY'
    text.source.fig.rawNodeFields.textDecorationFillPaints = [
      {
        type: 'PATTERN',
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 1,
        sourceNodeId: { sessionID: 4, localID: 900 }
      }
    ]
    text.source.fig.rawNodeFields.textUnderlineOffset = { value: 2, units: 'PIXELS' }
    text.source.fig.rawNodeFields.textDecorationThickness = { value: 1.5, units: 'PIXELS' }
    text.source.fig.rawNodeFields.toggledOnOTFeatures = ['DLIG']
    text.source.fig.rawNodeFields.toggledOffOTFeatures = ['LIGA']
    text.source.fig.rawNodeFields.semanticWeight = 'BOLD'
    text.source.fig.rawNodeFields.semanticItalic = 'ITALIC'
    text.source.fig.rawNodeFields.derivedTextData = {
      layoutSize: { x: 80, y: 20 },
      derivedLines: [{ directionality: 'LTR' }]
    }

    const decoded = decodeExport(await exportFigFile(graph))
    const exported = decoded.nodeChanges.find(
      (nodeChange) => nodeChange.guid && guidToString(nodeChange.guid) === '4:502'
    )

    expect(exported?.leadingTrim).toBe('CAP_HEIGHT')
    expect(exported?.textDecorationStyle).toBe('WAVY')
    expect(exported?.textDecorationFillPaints).toEqual(
      text.source.fig.rawNodeFields.textDecorationFillPaints
    )
    expect(exported?.textUnderlineOffset).toEqual({ value: 2, units: 'PIXELS' })
    expect(exported?.textDecorationThickness).toEqual({ value: 1.5, units: 'PIXELS' })
    expect(exported?.toggledOnOTFeatures).toEqual(['DLIG'])
    expect(exported?.toggledOffOTFeatures).toEqual(['LIGA'])
    expect(exported?.semanticWeight).toBe('BOLD')
    expect(exported?.semanticItalic).toBe('ITALIC')
    expect(exported?.derivedTextData?.layoutSize).toEqual({ x: 80, y: 20 })
  })

  test('preserves imported grid, export, and prototype metadata for round-trip', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { name: 'Imported metadata frame' })
    frame.source.format = 'fig'
    frame.source.id = '4:505'
    frame.source.fig.rawNodeFields.layoutGrids = [
      {
        type: 'MIN',
        axis: 'X',
        visible: true,
        numSections: 12,
        offset: 16,
        sectionSize: 64,
        gutterSize: 24,
        color: { r: 1, g: 0, b: 0, a: 0.1 },
        pattern: 'STRIPES'
      }
    ]
    frame.source.fig.rawNodeFields.exportSettings = [
      {
        suffix: '@2x',
        imageType: 'PNG',
        constraint: { type: 'CONTENT_SCALE', value: 2 },
        contentsOnly: true,
        useAbsoluteBounds: false
      }
    ]
    frame.source.fig.rawNodeFields.prototypeStartNodeID = { sessionID: 4, localID: 900 }
    frame.source.fig.rawNodeFields.transitionInfo = { type: 'DISSOLVE', duration: 0.2 }

    const decoded = decodeExport(await exportFigFile(graph))
    const exported = decoded.nodeChanges.find(
      (nodeChange) => nodeChange.guid && guidToString(nodeChange.guid) === '4:505'
    )

    expect(exported?.layoutGrids?.[0]?.type).toBe('MIN')
    expect(exported?.layoutGrids?.[0]?.axis).toBe('X')
    expect(exported?.layoutGrids?.[0]?.color?.a).toBeCloseTo(0.1)
    expect(exported?.exportSettings).toEqual(frame.source.fig.rawNodeFields.exportSettings)
    expect(exported?.prototypeStartNodeID).toEqual({ sessionID: 4, localID: 900 })
    expect(exported?.transitionInfo?.type).toBe('DISSOLVE')
  })

  test('clears imported raw metadata when visual fields are edited', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { name: 'Edited metadata frame' })
    frame.source.format = 'fig'
    frame.source.id = '4:506'
    frame.source.fig.rawNodeFields.layoutGrids = [{ type: 'MIN', axis: 'X', visible: true }]
    frame.source.fig.rawNodeFields.exportSettings = [{ suffix: '@2x' }]
    frame.source.fig.rawNodeFields.prototypeInteractions = [{ trigger: 'ON_CLICK' }]

    graph.updateNode(frame.id, {
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.2, g: 0.4, b: 0.8, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })

    expect(frame.source.fig.rawNodeFields).toEqual({})
  })

  test('preserves imported unsupported effect payloads for round-trip', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Noise effect metadata',
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 2 },
          radius: 4,
          spread: 0,
          visible: true
        }
      ]
    })
    rect.source.format = 'fig'
    rect.source.id = '4:503'
    rect.source.fig.rawNodeFields.effects = [
      {
        type: 'NOISE',
        visible: true,
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 0,
        noiseSize: { x: 0.5, y: 0.5 },
        noiseType: 'MONOTONE',
        color: { r: 0, g: 0, b: 0, a: 1 },
        density: 0.4
      }
    ]

    const decoded = decodeExport(await exportFigFile(graph))
    const exported = decoded.nodeChanges.find(
      (nodeChange) => nodeChange.guid && guidToString(nodeChange.guid) === '4:503'
    )

    expect(exported?.effects?.[0]?.type).toBe('NOISE')
    expect(exported?.effects?.[0]?.noiseType).toBe('MONOTONE')
    expect(exported?.effects?.[0]?.noiseSize).toEqual({ x: 0.5, y: 0.5 })
    expect(exported?.effects?.[0]?.density).toBeCloseTo(0.4)
  })

  test('clears raw unsupported effects when normalized effects are edited', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, { name: 'Edited effect metadata' })
    rect.source.format = 'fig'
    rect.source.id = '4:504'
    rect.source.fig.rawNodeFields.effects = [
      {
        type: 'NOISE',
        visible: true,
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 0,
        noiseSize: { x: 0.5, y: 0.5 },
        noiseType: 'MONOTONE',
        color: { r: 0, g: 0, b: 0, a: 1 },
        density: 0.4
      }
    ]

    graph.updateNode(rect.id, {
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.2 },
          offset: { x: 0, y: 4 },
          radius: 8,
          spread: 0,
          visible: true
        }
      ]
    })

    expect(rect.source.fig.rawNodeFields.effects).toBeUndefined()
  })

  test('clears raw font variation payloads when normalized axes are edited', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      name: 'Variable font text',
      text: 'Axis',
      fontVariations: [{ axis: 'wght', value: 400 }]
    })
    text.source.format = 'fig'
    text.source.id = '4:501'
    text.source.fig.rawNodeFields.fontVariations = [{ axisName: 'wght', value: 900 }]

    graph.updateNode(text.id, { fontVariations: [{ axis: 'wght', value: 650 }] })

    const decoded = decodeExport(await exportFigFile(graph))
    const exported = decoded.nodeChanges.find(
      (nodeChange) => nodeChange.guid && guidToString(nodeChange.guid) === '4:501'
    )

    expect(text.source.fig.rawNodeFields.fontVariations).toBeUndefined()
    expect(exported?.fontVariations).toEqual([
      { axisTag: 0x77676874, axisName: 'wght', value: 650 }
    ])
  })

  test('exports imported raw vector payloads without regenerating vector data', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rawVectorBlob = new Uint8Array([1, 2, 3, 4, 5])

    const vector = graph.createNode('VECTOR', page.id, {
      name: 'Imported vector',
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    })
    vector.source.format = 'fig'
    vector.source.id = '4:465'
    vector.source.fig.rawNodeFields.vectorData = {
      normalizedSize: { x: 0, y: 0 },
      vectorNetworkBlob: { __inklyFigmaBlob: rawVectorBlob }
    }

    const decoded = decodeExport(await exportFigFile(graph))
    const exported = decoded.nodeChanges.find(
      (nodeChange) => nodeChange.guid && guidToString(nodeChange.guid) === '4:465'
    )

    expect(exported?.vectorData?.normalizedSize).toEqual({ x: 0, y: 0 })
    const blobIndex = exported?.vectorData?.vectorNetworkBlob
    expect(typeof blobIndex).toBe('number')
    expect(decoded.blobs[blobIndex as number]).toEqual(rawVectorBlob)
  })
})
