import { describe, expect, test } from 'bun:test'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { parseFigBuffer } from '@open-pencil/kiwi/fig/parse'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { exportFigFile } from '#core/io/formats/fig/export'
import { nodeChangeToProps } from '#core/kiwi/fig/node-change/convert'
import { convertFigmaDerivedTextGlyphs } from '#core/kiwi/fig/node-change/derived-text-glyphs'
import { encodeVectorNetworkBlob } from '#core/vector'

import { expectDefined } from '#tests/helpers/assert'
import { loadFigFixture } from '#tests/helpers/fig-fixture'

/** exportFigFile returns a Uint8Array; parseFigBuffer takes an ArrayBuffer. */
function reparse(out: Uint8Array) {
  return parseFigBuffer(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength))
}

function emptyBlob(size = 8): Uint8Array {
  return new Uint8Array(size)
}

describe('TEXT_PATH import mapping', () => {
  test('maps TEXT_PATH to TEXT and records kiwiNodeType marker', () => {
    const props = nodeChangeToProps(
      {
        type: 'TEXT_PATH',
        name: 'Along path',
        fontSize: 24,
        textData: { characters: 'Hello' },
        size: { x: 100, y: 100 },
        fillPaints: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ]
      } as NodeChange,
      []
    )

    expect(props.nodeType).toBe('TEXT')
    expect(props.name).toBe('Along path')
    expect(props.text).toBe('Hello')
    expect(props.source?.fig.kiwiNodeType).toBe('TEXT_PATH')
  })

  test('preserves glyph rotation from derivedTextData', () => {
    const blob = emptyBlob(16)
    const glyphs = convertFigmaDerivedTextGlyphs(
      {
        glyphs: [
          {
            commandsBlob: 0,
            position: { x: 10, y: 20 },
            fontSize: 80,
            rotation: -1.75
          },
          {
            commandsBlob: 0,
            position: { x: 12, y: 22 },
            fontSize: 80,
            rotation: 0
          }
        ]
      },
      [blob]
    )

    expect(glyphs).toHaveLength(2)
    expect(glyphs[0]?.rotation).toBeCloseTo(-1.75, 5)
    expect(glyphs[0]?.x).toBe(10)
    expect(glyphs[0]?.y).toBe(20)
    expect(glyphs[0]?.fontSize).toBe(80)
    expect(glyphs[1]?.rotation).toBe(0)
  })
})

const LOCAL_CIRCLE_TEXT = 'tests/fixtures/circle-text.fig'

describe('TEXT_PATH real fixture (optional local)', () => {
  test('imports circular path text without RECTANGLE occlusion type', async () => {
    const graph = await loadFigFixture(LOCAL_CIRCLE_TEXT)
    if (!graph) return

    const pathText = expectDefined(
      [...graph.getAllNodes()].find((n) => n.name === 'ArnoCoenen.art'),
      'path text node'
    )
    expect(pathText.type).toBe('TEXT')
    expect(pathText.type).not.toBe('RECTANGLE')
    expect(pathText.text).toContain('ArnoCoenen')
    expect(pathText.source.fig.kiwiNodeType).toBe('TEXT_PATH')
    expect(pathText.figmaDerivedTextGlyphs?.length).toBeGreaterThan(0)
    expect(pathText.figmaDerivedTextGlyphs?.some((g) => (g.rotation ?? 0) !== 0)).toBe(true)
    expect(pathText.strokeGeometry.length).toBeGreaterThan(0)

    // Multi-color logo sibling must remain a VECTOR (not covered by type fallback)
    const icon = expectDefined(
      [...graph.getAllNodes()].find((n) => n.name === 'ArnoIcon' && n.type === 'VECTOR'),
      'ArnoIcon vector'
    )
    expect(icon.fillGeometry.length).toBeGreaterThan(0)

    // Unedited export preserves TEXT_PATH type
    const out = await exportFigFile(graph)
    const reparsed = reparse(out)
    const exported = reparsed.nodeChanges.find((nc) => nc.name === 'ArnoCoenen.art')
    expect(exported?.type).toBe('TEXT_PATH')
    const rotations = exported?.derivedTextData?.glyphs?.map((g) => g.rotation ?? 0) ?? []
    expect(rotations.some((r) => r !== 0)).toBe(true)
  })
})

function unitSquareBlob(): Uint8Array {
  const blob = new Uint8Array(1 + 4 * 9 + 1)
  const view = new DataView(blob.buffer)
  const pts = [
    [1, 0, 0],
    [2, 1, 0],
    [2, 1, 1],
    [2, 0, 1]
  ] as const
  let offset = 0
  for (const [cmd, x, y] of pts) {
    blob[offset] = cmd
    view.setFloat32(offset + 1, x, true)
    view.setFloat32(offset + 5, y, true)
    offset += 9
  }
  return blob
}

describe('TEXT_PATH resize export', () => {
  test('bakes glyph scaleX/scaleY into blobs — Kiwi Glyph has no scale field', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('TEXT', page.id, {
      text: 'A',
      width: 100,
      height: 100,
      figmaDerivedTextGlyphs: [
        {
          commandsBlob: unitSquareBlob(),
          x: 10,
          y: 20,
          fontSize: 40,
          rotation: Math.PI / 2,
          scaleX: 0.5,
          scaleY: 1
        }
      ]
    })
    node.source.fig.kiwiNodeType = 'TEXT_PATH'

    const out = await exportFigFile(graph)
    const reparsed = reparse(out)
    const exported = expectDefined(reparsed.nodeChanges.find((nc) => nc.type === 'TEXT_PATH'))
    const glyph = expectDefined(exported.derivedTextData?.glyphs?.[0])
    const blob = expectDefined(reparsed.blobs[expectDefined(glyph.commandsBlob)])

    // At θ=π/2 the horizontal squash lands on the glyph's local Y axis:
    // (1,1) → (1,0.5). Without baking, reload would draw unscaled shapes at
    // scaled positions (the DomeSticker save/reopen garble).
    const view = new DataView(blob.buffer, blob.byteOffset)
    expect(view.getFloat32(2 * 9 + 1, true)).toBeCloseTo(1, 4)
    expect(view.getFloat32(2 * 9 + 5, true)).toBeCloseTo(0.5, 4)
  })
})

describe('TEXT_PATH raw payload round-trip (synthetic)', () => {
  test('vectorData + textPathStart survive .fig export unchanged', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const networkBlob = encodeVectorNetworkBlob({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    })
    const node = graph.createNode('TEXT', page.id, {
      text: 'A',
      width: 100,
      height: 100,
      figmaDerivedTextGlyphs: [
        { commandsBlob: unitSquareBlob(), x: 10, y: 20, fontSize: 40, rotation: 0 }
      ]
    })
    node.source.fig.kiwiNodeType = 'TEXT_PATH'
    node.source.fig.rawNodeFields = {
      vectorData: {
        vectorNetworkBlob: { __openPencilFigmaBlob: networkBlob },
        normalizedSize: { x: 100, y: 100 }
      },
      textPathStart: { tValue: 0.3, forward: false }
    }

    const out = await exportFigFile(graph)
    const reparsed = reparse(out)
    const exported = expectDefined(reparsed.nodeChanges.find((nc) => nc.type === 'TEXT_PATH'))

    const rawExported = exported as typeof exported & Record<string, unknown>
    const vectorData = rawExported.vectorData as {
      vectorNetworkBlob?: number
      normalizedSize?: Vector
    }
    expect(vectorData.normalizedSize).toEqual({ x: 100, y: 100 })
    const blobIndex = expectDefined(vectorData.vectorNetworkBlob, 'vectorNetworkBlob index')
    const exportedBlob = expectDefined(reparsed.blobs[blobIndex], 'exported network blob')
    expect(Buffer.from(exportedBlob).equals(Buffer.from(networkBlob))).toBe(true)

    const textPathStart = rawExported.textPathStart as { tValue?: number; forward?: boolean }
    expect(textPathStart.tValue).toBeCloseTo(0.3, 6)
    expect(textPathStart.forward).toBe(false)
  })
})

describe('TEXT_PATH edit invalidation', () => {
  test('clears kiwiNodeType when text content is edited', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('TEXT', page.id, {
      text: 'ArnoCoenen.art',
      figmaDerivedTextGlyphs: [
        {
          commandsBlob: emptyBlob(),
          x: 0,
          y: 0,
          fontSize: 80,
          rotation: -1.5
        }
      ]
    })
    node.source.fig.kiwiNodeType = 'TEXT_PATH'

    graph.updateNode(node.id, { text: 'Edited' })

    const updated = expectDefined(graph.getNode(node.id))
    expect(updated.figmaDerivedTextGlyphs).toBeNull()
    expect(updated.source.fig.kiwiNodeType).toBeNull()
  })
})
