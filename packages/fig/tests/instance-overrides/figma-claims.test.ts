import { expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const guid = (localID: number) => ({ sessionID: 2, localID })

// A claim Figma wrote for a rectangle overridden in an instance, live Figma 2026-10-10.
const FIGMA_CLAIM = {
  guidPath: { guids: [guid(328)] },
  locked: true,
  blendMode: 'MULTIPLY',
  dashPattern: [4, 2],
  cornerRadius: 12,
  strokeWeight: 7,
  strokeAlign: 'OUTSIDE',
  strokeCap: 'ROUND',
  strokeJoin: 'BEVEL',
  rectangleTopLeftCornerRadius: 12,
  rectangleTopRightCornerRadius: 12,
  rectangleBottomLeftCornerRadius: 12,
  rectangleBottomRightCornerRadius: 12,
  borderTopWeight: 7,
  borderBottomWeight: 7,
  borderLeftWeight: 7,
  borderRightWeight: 7,
  cornerSmoothing: 0.5
}

test('fields Figma claims on an instance layer import as overrides', () => {
  const changes: NodeChange[] = [
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    {
      guid: guid(327),
      type: 'SYMBOL',
      name: 'Card',
      parentIndex: { guid: guid(1), position: '!' },
      size: { x: 300, y: 200 }
    },
    {
      guid: guid(328),
      type: 'ROUNDED_RECTANGLE',
      name: 'Box',
      parentIndex: { guid: guid(327), position: '!' },
      size: { x: 100, y: 50 },
      strokePaints: [
        { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
      ]
    },
    {
      guid: guid(333),
      type: 'INSTANCE',
      name: 'Inst',
      parentIndex: { guid: guid(1), position: '"' },
      size: { x: 300, y: 200 },
      symbolData: { symbolID: guid(327), symbolOverrides: [FIGMA_CLAIM] }
    } as NodeChange
  ]
  const { graph, sources } = materializeDocument(changes)
  const instanceId = sources.get('2:333')
  if (!instanceId) throw new Error('Missing instance')
  const instance = graph.getNode(instanceId)
  const [box] = graph.getChildren(instanceId)

  expect(box).toMatchObject({
    locked: true,
    blendMode: 'MULTIPLY',
    dashPattern: [4, 2],
    cornerRadius: 12,
    topLeftRadius: 12,
    strokeAlign: 'OUTSIDE',
    strokeCap: 'ROUND',
    strokeJoin: 'BEVEL',
    cornerSmoothing: 0.5
  })
  expect(box.strokes[0]?.weight).toBe(7)
  const claimed = [...(instance?.instanceOverrides.descendants.get(box.id)?.keys() ?? [])]
  expect(claimed).toEqual(
    expect.arrayContaining([
      'locked',
      'blendMode',
      'dashPattern',
      'cornerRadius',
      'topLeftRadius',
      'strokeWeight',
      'strokeAlign',
      'strokeCap',
      'strokeJoin',
      'cornerSmoothing',
      'borderTopWeight'
    ])
  )
})
