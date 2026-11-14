import { expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

const OUTLINE = { windingRule: 'NONZERO' as const, commandsBlob: new Uint8Array([1, 2, 3, 4]) }

test('resize drops a saved stroke outline on a frame instead of leaving it at the old size', () => {
  const graph = new SceneGraph()
  const frame = new FigmaAPI(graph).createFrame()
  frame.resize(38, 20)
  graph.updateNode(frame.id, { strokeGeometry: [OUTLINE] })

  frame.resize(38, 20)
  expect(graph.getNode(frame.id)?.strokeGeometry).toEqual([OUTLINE])

  frame.resize(226, 20)

  expect(graph.getNode(frame.id)?.width).toBe(226)
  expect(graph.getNode(frame.id)?.strokeGeometry).toEqual([])
  expect(graph.getNode(frame.id)?.source.editedFields).toContain('strokeGeometry')
})
