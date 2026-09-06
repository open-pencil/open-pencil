import { renderNodesToImage } from '@open-pencil/core/io'

import type { NodePresentation } from '@/app/ai/attachment/presentation/types'
import type { ReferencedNode } from '@/app/ai/chat/context'
import type { EditorStore } from '@/app/editor/active-store'

export function snapshotNode(
  store: EditorStore,
  messageId: string,
  node: ReferencedNode
): NodePresentation | null {
  const renderer = store.renderer
  const liveNode = store.graph.getNode(node.id)
  if (!renderer || !liveNode) return null
  const maxDimension = Math.max(liveNode.width, liveNode.height, 1)
  const data = renderNodesToImage(
    renderer.ck,
    renderer,
    store.graph,
    store.state.currentPageId,
    [node.id],
    { scale: 320 / maxDimension, format: 'PNG' }
  )
  if (!data) return null
  const previewBytes = new Uint8Array(data.byteLength)
  previewBytes.set(data)
  return {
    id: crypto.randomUUID(),
    messageId,
    kind: 'node',
    name: node.name || node.type,
    preview: new Blob([previewBytes.buffer], { type: 'image/png' }),
    nodeId: node.id,
    nodeType: node.type,
    originalSize: { x: liveNode.width, y: liveNode.height }
  }
}
