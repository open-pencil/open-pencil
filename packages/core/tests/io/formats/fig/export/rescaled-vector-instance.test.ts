import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core/editor'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { renderNodesToSVG } from '@open-pencil/core/io/formats/svg'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import { derivedSymbolDataOf } from '@open-pencil/fig/instance-overrides'
import { encodePathCommandsBlob } from '@open-pencil/fig/node-change'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

const RED = { r: 1, g: 0, b: 0, a: 1 }

interface Variant {
  regionFills: boolean
  painted: boolean
  geometryOnly: boolean
  strokeOutline: boolean
  // The file also saved the instance's own fill outline, already at the placed size.
  savedDerived?: boolean
}

async function rescaledInstance({
  regionFills,
  painted,
  geometryOnly,
  strokeOutline,
  savedDerived
}: Variant) {
  const graph = new SceneGraph()
  createEditor({ graph })
  const api = new FigmaAPI(graph)
  const component = api.createComponent()
  component.resize(24, 24)
  const vector = api.createVector()
  component.appendChild(vector)
  vector.x = 2
  vector.y = 2
  vector.resize(20, 20)
  await vector.setVectorNetworkAsync({
    vertices: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ],
    segments: [0, 1, 2, 3].map((i) => ({ start: i, end: (i + 1) % 4 })),
    regions: [
      { windingRule: 'NONZERO', loops: [[0, 1, 2, 3]], ...(regionFills ? { fills: [] } : {}) }
    ]
  } as never)
  if (painted) vector.fills = [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
  // A vector the file saved as outlines only has no path of its own to redraw from.
  if (geometryOnly) graph.updateNode(vector.id, { vectorNetwork: null })
  if (strokeOutline) {
    // Outlines of a stroke the file saved, drawn at the component's size. They are a diamond, not
    // the fill's square, so the stroke has coordinates of its own to check.
    const outline = api.createVector()
    await outline.setVectorNetworkAsync({
      vertices: [
        { x: 10, y: 0 },
        { x: 20, y: 10 },
        { x: 10, y: 20 },
        { x: 0, y: 10 }
      ],
      segments: [0, 1, 2, 3].map((i) => ({ start: i, end: (i + 1) % 4 })),
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]], fills: [] }]
    } as never)
    const strokeGeometry = expectDefined(graph.getNode(outline.id)).fillGeometry.map((path) => ({
      ...path
    }))
    outline.remove()
    graph.updateNode(vector.id, {
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          weight: 2,
          align: 'CENTER'
        }
      ],
      strokeGeometry
    })
  }
  const instance = component.createInstance()
  instance.rescale(16 / 24)

  await initCodec()
  const bytes = await exportFigFile(graph)
  const parsed = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
  if (savedDerived) {
    // Outlines the file saved for the instance: a triangle at the placed size, which must be
    // taken as it is and not scaled down a second time like the component's inherited ones.
    // The encoder flips y, as glyph outlines are y-up, so y is given negated.
    const savedBlob = parsed.blobs.push(
      encodePathCommandsBlob([
        { type: 'M', x: 0, y: 0 },
        { type: 'L', x: 10, y: 0 },
        { type: 'L', x: 10, y: -10 },
        { type: 'Z' }
      ])
    )
    const instanceChange = expectDefined(parsed.nodeChanges.find((nc) => nc.type === 'INSTANCE'))
    const vectorChange = expectDefined(parsed.nodeChanges.find((nc) => nc.type === 'VECTOR'))
    const entry = expectDefined(
      derivedSymbolDataOf(instanceChange).find(
        (e) => e.guidPath?.guids?.[0]?.localID === vectorChange.guid?.localID
      )
    )
    entry.fillGeometry = [{ windingRule: 'NONZERO', commandsBlob: savedBlob - 1 }]
  }
  const reopened = materializeDocument(parsed.nodeChanges, parsed.blobs, { derivedBounds: true })
  const reopenedInstance = expectDefined(
    [...reopened.graph.nodes.values()].find((node) => node.type === 'INSTANCE')
  )
  const page = expectDefined(reopened.graph.getPages()[0])
  return expectDefined(renderNodesToSVG(reopened.graph, page.id, [reopenedInstance.id]))
}

const variants: Variant[] = [
  { regionFills: false, painted: false, geometryOnly: false, strokeOutline: false },
  { regionFills: true, painted: false, geometryOnly: false, strokeOutline: false },
  { regionFills: true, painted: true, geometryOnly: false, strokeOutline: false },
  { regionFills: true, painted: true, geometryOnly: true, strokeOutline: false },
  { regionFills: true, painted: true, geometryOnly: false, strokeOutline: true },
  {
    regionFills: true,
    painted: true,
    geometryOnly: false,
    strokeOutline: false,
    savedDerived: true
  }
]

for (const variant of variants) {
  test(`a rescaled instance keeps its vector at the instance size after reopening (${JSON.stringify(variant)})`, async () => {
    const svg = await rescaledInstance(variant)
    if (variant.savedDerived) {
      // The saved outline replaces the inherited one and keeps its own size: not 20 (the
      // component's), not 13.33 (the inherited one scaled), and not 6.67 (scaled twice).
      expect(svg).toContain('L10 0L10 10')
      expect(svg).not.toContain('L20 0')
      expect(svg).not.toContain('L13.33 0')
      expect(svg).not.toContain('L6.67 0')
      return
    }
    expect(svg).toContain('L13.33 0L13.33 13.33')
    expect(svg).not.toContain('L20 0')
    if (variant.strokeOutline) {
      // The stroke's own outline, a diamond, is scaled by itself and not taken from the fill.
      expect(svg).toContain('L13.33 6.67')
      expect(svg).not.toContain('L20 10')
    }
  })
}
