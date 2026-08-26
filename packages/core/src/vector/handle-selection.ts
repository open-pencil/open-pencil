export type VectorHandleField = 'tangentStart' | 'tangentEnd'

export function vectorHandleId(segmentIndex: number, tangentField: VectorHandleField): number {
  return segmentIndex * 2 + (tangentField === 'tangentEnd' ? 1 : 0)
}

export function vectorHandleParts(
  handleId: number
): { segmentIndex: number; tangentField: VectorHandleField } | null {
  if (!Number.isSafeInteger(handleId) || handleId < 0) return null
  const segmentIndex = Math.floor(handleId / 2)
  return {
    segmentIndex,
    tangentField: handleId % 2 === 0 ? 'tangentStart' : 'tangentEnd'
  }
}
