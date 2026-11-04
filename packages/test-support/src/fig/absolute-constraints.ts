import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

export function absoluteConstraintRecords(): NodeChange[] {
  const guid = (localID: number) => ({ sessionID: 1, localID })
  return [
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    {
      guid: guid(2),
      type: 'SYMBOL',
      parentIndex: { guid: guid(1), position: '!' },
      size: { x: 100, y: 80 },
      stackMode: 'HORIZONTAL'
    },
    {
      guid: guid(3),
      type: 'RECTANGLE',
      parentIndex: { guid: guid(2), position: '!' },
      size: { x: 10, y: 60 },
      transform: { m00: 1, m01: 0, m02: 80, m10: 0, m11: 1, m12: 10 },
      stackPositioning: 'ABSOLUTE',
      horizontalConstraint: 'MAX',
      verticalConstraint: 'STRETCH',
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 217 / 255, g: 217 / 255, b: 217 / 255, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '"' },
      size: { x: 200, y: 120 },
      symbolData: { symbolID: guid(2) }
    }
  ]
}
