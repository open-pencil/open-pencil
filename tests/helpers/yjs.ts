import * as Y from 'yjs'

export function connectYDocs(left: Y.Doc, right: Y.Doc): () => void {
  const syncLeftToRight = (update: Uint8Array) => Y.applyUpdate(right, update)
  const syncRightToLeft = (update: Uint8Array) => Y.applyUpdate(left, update)

  left.on('update', syncLeftToRight)
  right.on('update', syncRightToLeft)

  Y.applyUpdate(right, Y.encodeStateAsUpdate(left))
  Y.applyUpdate(left, Y.encodeStateAsUpdate(right))

  return () => {
    left.off('update', syncLeftToRight)
    right.off('update', syncRightToLeft)
  }
}
