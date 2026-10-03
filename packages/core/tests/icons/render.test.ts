import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { parseColor } from '@open-pencil/scene-graph/color'

import { createIconFromPaths } from '#core/icons/render'
import { buildIconData } from '#core/icons/svg'

const BLACK = parseColor('#000000')

function insertIcon(graph: SceneGraph, body: string, viewBox = 24, size = 24) {
  const icon = buildIconData({ body }, 'test', 'icon', viewBox, viewBox, size)
  const page = graph.getPages()[0]
  const frame = createIconFromPaths(graph, icon, 'test:icon', size, BLACK, page.id)
  return { page, frame, vectors: graph.getChildren(frame.id) }
}

describe('createIconFromPaths', () => {
  test('keeps round stroke caps and joins after a .fig round trip', async () => {
    const graph = new SceneGraph()
    insertIcon(
      graph,
      '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9l6 6l6-6"/>'
    )

    const bytes = await exportFigFile(graph)
    const reopened = await parseFigFile(bytes.buffer as ArrayBuffer)
    const vector = expectDefined(
      [...reopened.nodes.values()].find((node) => node.type === 'VECTOR'),
      'reopened icon vector'
    )

    expect(vector.strokeCap).toBe('ROUND')
    expect(vector.strokeJoin).toBe('ROUND')
    expect(vector.strokes.map(({ cap, join }) => ({ cap, join }))).toEqual([
      { cap: 'ROUND', join: 'ROUND' }
    ])
  })
})
