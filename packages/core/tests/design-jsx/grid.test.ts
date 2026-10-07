import { expect, test } from 'bun:test'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

test('a repeat() grid places its cells in equal columns, not collapsed ones', async () => {
  const graph = new SceneGraph()
  const cells = Array.from({ length: 14 }, (_, i) => `<Frame name="C${i}" w={20} h={36} />`)
  const [root] = await renderJSX(
    graph,
    `<Frame grid columns="repeat(7, 1fr)" gap={4} w={280}>${cells.join('')}</Frame>`
  )

  const column = (280 - 6 * 4) / 7
  const children = getNodeOrThrow(graph, root.id).childIds.map((id) => getNodeOrThrow(graph, id))
  for (const [index, cell] of children.entries()) {
    expect(cell.x).toBeCloseTo((index % 7) * (column + 4), 3)
    expect(cell.y).toBe(Math.floor(index / 7) * 40)
    expect(cell.height).toBe(36)
  }
})
