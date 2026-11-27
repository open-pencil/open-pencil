import { expect, test } from 'bun:test'

import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'

import { createFigDocumentSession } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { getSharedStyles } from '@open-pencil/scene-graph/shared-styles'
import { guid } from '@open-pencil/test-support/fig/guid'

const RED: NonNullable<NodeChange['fillPaints']> = [
  { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }
]

/**
 * A file as Figma saves one: its styles on the internal canvas, a paint style no layer uses, and a
 * text style deleted while a text still names it, which Figma keeps soft deleted.
 */
function records(): NodeChange[] {
  const under = (parent: number, position: string) => ({ guid: guid(parent), position })
  return [
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', name: 'Page', parentIndex: under(0, '!') },
    { guid: guid(2), type: 'CANVAS', internalOnly: true, parentIndex: under(0, '"') },
    {
      guid: guid(3),
      type: 'RECTANGLE',
      name: 'Unused',
      styleType: 'FILL',
      parentIndex: under(2, '!'),
      fillPaints: RED
    },
    {
      guid: guid(4),
      type: 'TEXT',
      name: 'Deleted',
      styleType: 'TEXT',
      isSoftDeleted: true,
      parentIndex: under(2, '"'),
      fontSize: 20
    },
    {
      guid: guid(5),
      type: 'TEXT',
      name: 'Label',
      parentIndex: under(1, '!'),
      textData: { characters: 'Hi' },
      fontSize: 12,
      styleIdForText: { guid: guid(4) }
    }
  ]
}

test('a file opens with every style it has not deleted, and texts on a deleted one detached', async () => {
  const session = createFigDocumentSession(await figArchiveOf(records()))
  for (const page of session.pages) session.loadPage(page.id)
  const label = [...session.graph.getAllNodes()].find((node) => node.name === 'Label')

  expect(getSharedStyles(session.graph, 'fill').map((style) => style.name)).toEqual(['Unused'])
  expect(getSharedStyles(session.graph, 'text')).toEqual([])
  expect([label?.textStyleId, label?.fontSize]).toEqual([null, 20])
})
