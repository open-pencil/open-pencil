import { expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'

test('uniform FIG scale covers corners, dashes, and effects', () => {
  const guid = (localID: number) => ({ sessionID: 1, localID })
  const { graph, sources } = materializeDocument([
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    {
      guid: guid(2),
      type: 'SYMBOL',
      parentIndex: { guid: guid(1), position: '!' },
      size: { x: 40, y: 20 }
    },
    {
      guid: guid(3),
      type: 'ROUNDED_RECTANGLE',
      parentIndex: { guid: guid(2), position: '!' },
      size: { x: 40, y: 20 },
      cornerRadius: 10,
      rectangleTopLeftCornerRadius: 2,
      rectangleTopRightCornerRadius: 4,
      rectangleBottomRightCornerRadius: 6,
      rectangleBottomLeftCornerRadius: 8,
      dashPattern: [2, 4],
      effects: [{ type: 'DROP_SHADOW', offset: { x: 3, y: 5 }, radius: 7, spread: 9 }]
    },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '"' },
      symbolData: { symbolID: guid(2), uniformScaleFactor: 2 },
      size: { x: 80, y: 40 }
    }
  ])
  const id = sources.get('1:4')
  if (!id) throw new Error('Missing instance')
  const child = graph.getChildren(id)[0]
  expect(child).toMatchObject({
    cornerRadius: 20,
    topLeftRadius: 4,
    topRightRadius: 8,
    bottomRightRadius: 12,
    bottomLeftRadius: 16,
    dashPattern: [4, 8]
  })
  expect(child.effects[0]).toMatchObject({ offset: { x: 6, y: 10 }, radius: 14, spread: 18 })
})

test('a scaled instance keeps its own placed-space visual values verbatim', () => {
  const guid = (localID: number) => ({ sessionID: 1, localID })
  const { graph, sources } = materializeDocument([
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    {
      guid: guid(2),
      type: 'SYMBOL',
      parentIndex: { guid: guid(1), position: '!' },
      size: { x: 40, y: 20 },
      cornerRadius: 10,
      strokePaints: [
        { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
      ],
      strokeWeight: 1,
      dashPattern: [2, 4],
      effects: [{ type: 'DROP_SHADOW', offset: { x: 3, y: 5 }, radius: 7, spread: 9 }]
    },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '"' },
      symbolData: { symbolID: guid(2), uniformScaleFactor: 2 },
      size: { x: 80, y: 40 },
      // The record already describes the placed result; scaling must not touch it.
      cornerRadius: 12,
      strokeWeight: 3,
      dashPattern: [1, 1],
      effects: [{ type: 'DROP_SHADOW', offset: { x: 1, y: 1 }, radius: 2, spread: 0 }]
    }
  ])
  const id = sources.get('1:4')
  if (!id) throw new Error('Missing instance')
  const node = graph.getNode(id)
  expect(node).toMatchObject({ width: 80, height: 40, cornerRadius: 12, dashPattern: [1, 1] })
  expect(node?.strokes[0]?.weight).toBe(3)
  expect(node?.effects[0]).toMatchObject({ offset: { x: 1, y: 1 }, radius: 2 })
})
