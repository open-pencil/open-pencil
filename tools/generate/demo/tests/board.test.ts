import { beforeAll, describe, expect, test } from 'bun:test'

import { buildDemoBoard } from '#demo/board'
import { BOARD_SECTION } from '#demo/board-names'

import { populateAllFigPages, readFigFile } from '@open-pencil/core/io/formats/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'

let graph: SceneGraph

beforeAll(async () => {
  // The .jam the docs landing opens from the gallery.
  graph = await readFigFile(new File([(await buildDemoBoard()).slice()], 'Sprint board.jam'))
  populateAllFigPages(graph)
})

describe('demo board', () => {
  test('opens as a board', () => {
    expect(graph.documentKind).toBe('board')
  })

  test('holds its stickies, headings, shapes, and connectors in the section the landing frames', () => {
    const [page] = graph.getPages()
    const section = graph.getChildren(page.id).find((node) => node.name === BOARD_SECTION)
    if (!section) throw new Error(`The board has no "${BOARD_SECTION}"`)
    const kinds = graph.getChildren(section.id).map((node) => node.type)
    expect(kinds.filter((type) => type === 'STICKY')).toHaveLength(4)
    expect(kinds.filter((type) => type === 'TEXT')).toHaveLength(2)
    expect(kinds.filter((type) => type === 'SHAPE_WITH_TEXT')).toHaveLength(6)
    expect(kinds.filter((type) => type === 'CONNECTOR')).toHaveLength(8)
  })
})
