import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core/editor'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile, renderNodesToSVG } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

const RED = { r: 1, g: 0, b: 0, a: 1 }

interface Variant {
  regionFills: boolean
  painted: boolean
  geometryOnly: boolean
  strokeOutline: boolean
}

async function rescaledInstance({ regionFills, painted, geometryOnly, strokeOutline }: Variant) {
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
    // Outlines of a stroke the file saved, drawn at the component's size.
    const saved = expectDefined(graph.getNode(vector.id))
    graph.updateNode(vector.id, {
      strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, weight: 2, align: 'CENTER' }],
      strokeGeometry: saved.fillGeometry.map((path) => ({ ...path }))
    })
  }
  const instance = component.createInstance()
  instance.rescale(16 / 24)

  await initCodec()
  const bytes = await exportFigFile(graph)
  const parsed = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
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
  { regionFills: true, painted: true, geometryOnly: false, strokeOutline: true }
]

for (const variant of variants) {
  test(`a rescaled instance keeps its vector at the instance size after reopening (${JSON.stringify(variant)})`, async () => {
    const svg = await rescaledInstance(variant)
    expect(svg).toContain('L13.33 0L13.33 13.33')
    expect(svg).not.toContain('L20 0')
  })
}
