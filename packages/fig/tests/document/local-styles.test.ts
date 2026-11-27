import { expect, test } from 'bun:test'

import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'

import { createFigDocumentSession } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
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
  const listed = () => [
    getSharedStyles(session.graph, 'fill').map((style) => style.name),
    getSharedStyles(session.graph, 'text').map((style) => style.name)
  ]
  expect(listed()).toEqual([['Unused'], []])

  // Loading every page, Figma's internal canvas among them, lists no deleted style either.
  for (const page of session.pages) session.loadPage(page.id)
  const label = [...session.graph.getAllNodes()].find((node) => node.name === 'Label')

  expect(listed()).toEqual([['Unused'], []])
  expect([label?.textStyleId, label?.fontSize]).toEqual([null, 20])
})

// Figma keeps the deleted style's variables on the text it detaches, which follows their modes.
test('a text on a deleted style keeps the variables the style bound', async () => {
  const set = guid(30)
  const compact = guid(31)
  const roomy = guid(32)
  const size = guid(33)
  const sizeIn = (modeID: typeof compact, value: number) => ({
    modeID,
    variableData: { dataType: 'FLOAT', value: { floatValue: value } }
  })
  const boundSize = {
    entries: [
      {
        variableField: 'FONT_SIZE',
        variableData: {
          dataType: 'ALIAS',
          resolvedDataType: 'FLOAT',
          value: { alias: { guid: size } }
        }
      }
    ]
  }
  const roomyMode = { entries: [{ variableSetID: { guid: set }, variableModeID: roomy }] }
  const file = records().map((record) => {
    if (record.name === 'Deleted') return { ...record, parameterConsumptionMap: boundSize }
    if (record.name === 'Label') return { ...record, variableModeBySetMap: roomyMode }
    return record
  })
  const session = createFigDocumentSession(
    await figArchiveOf([
      ...file,
      {
        guid: set,
        type: 'VARIABLE_SET',
        variableSetModes: [
          { id: compact, name: 'Compact', sortPosition: 'a' },
          { id: roomy, name: 'Roomy', sortPosition: 'b' }
        ]
      },
      {
        guid: size,
        type: 'VARIABLE',
        variableResolvedType: 'FLOAT',
        variableSetID: { guid: set },
        variableDataValues: { entries: [sizeIn(compact, 20), sizeIn(roomy, 32)] }
      }
    ] as NodeChange[])
  )
  for (const page of session.pages) session.loadPage(page.id)
  const label = [...session.graph.getAllNodes()].find((node) => node.name === 'Label')

  expect([label?.textStyleId, label?.fontSize]).toEqual([null, 32])
  expect(label?.boundVariables.fontSize).toBe(guidToString(size))
})
