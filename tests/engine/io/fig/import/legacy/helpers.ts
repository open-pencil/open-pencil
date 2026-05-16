import type { NodeChange } from '@open-pencil/core'

export function doc(): NodeChange {
  return {
    guid: { sessionID: 0, localID: 0 },
    type: 'DOCUMENT',
    name: 'Document',
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  } as NodeChange
}

export function canvas(localID = 1): NodeChange {
  return {
    guid: { sessionID: 0, localID },
    parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
    type: 'CANVAS',
    name: 'Page 1',
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  } as NodeChange
}

export function node(
  type: string,
  localID: number,
  parentLocalID: number,
  overrides: Partial<NodeChange> = {}
): NodeChange {
  return {
    guid: { sessionID: 1, localID },
    parentIndex: {
      guid: { sessionID: 0, localID: parentLocalID },
      position: String.fromCharCode(33 + localID)
    },
    type,
    name: `${type}_${localID}`,
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    size: { x: 100, y: 100 },
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
    ...overrides
  } as NodeChange
}
