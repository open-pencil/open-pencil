import { restoreSubtree, snapshotSubtree } from '@open-pencil/core/editor/clipboard/subtree-history'
import type { Fill, SceneNode } from '@open-pencil/core/scene-graph'
import { preprocessForVectorize, svgToVectorPaths } from '@open-pencil/core/tools'

import {
  falApiKey,
  recraftApiKey,
  vectorizeProvider,
  type VectorizeProviderId
} from '@/app/ai/chat/storage'
import type { EditorStore } from '@/app/editor/active-store'
import { falVectorize, recraftVectorize } from '@/app/editor/vectorize/providers'
import { toast } from '@/app/shell/ui'

let vectorizeInFlight = false

function getImageFill(node: SceneNode): Fill | null {
  const fill = node.fills.find((entry) => entry.type === 'IMAGE' && entry.imageHash)
  return fill ?? null
}

function activeVectorizeKey(provider: VectorizeProviderId): string {
  return provider === 'fal' ? falApiKey.value.trim() : recraftApiKey.value.trim()
}

export function canVectorizeImageNode(store: EditorStore): boolean {
  if (store.state.selectedIds.size !== 1) return false
  const nodeId = [...store.state.selectedIds][0]
  const node = store.graph.getNode(nodeId)
  if (!node) return false
  const fill = getImageFill(node)
  return fill?.type === 'IMAGE' && !!fill.imageHash
}

export async function vectorizeImageNode(store: EditorStore, nodeId: string): Promise<void> {
  if (vectorizeInFlight) return

  const node = store.graph.getNode(nodeId)
  if (!node) return

  const imageFill = getImageFill(node)
  if (imageFill?.type !== 'IMAGE' || !imageFill.imageHash) return

  const provider = vectorizeProvider.value
  const apiKey = activeVectorizeKey(provider)
  if (!apiKey) {
    toast.error('Add a vectorization API key in provider settings')
    return
  }

  const bytes = store.graph.images.get(imageFill.imageHash)
  if (!bytes) {
    toast.error('Image data is missing for this layer')
    return
  }

  vectorizeInFlight = true
  toast.info('Vectorizing image…')

  try {
    const preprocessed = preprocessForVectorize(bytes, () => store.renderer?.ck ?? null)
    if (!preprocessed) {
      throw new Error('Could not prepare image for vectorization')
    }

    const svgText =
      provider === 'fal'
        ? await falVectorize(preprocessed.pngBytes, apiKey)
        : await recraftVectorize(preprocessed.pngBytes, apiKey)

    const vectorized = svgToVectorPaths(svgText, {
      width: node.width,
      height: node.height
    })
    if (!vectorized || vectorized.paths.length === 0) {
      throw new Error('Vectorizer returned no editable paths')
    }

    const parentId = node.parentId
    if (!parentId) throw new Error('Image node has no parent')

    const parent = store.graph.getNode(parentId)
    if (!parent) throw new Error('Image parent is missing')

    const insertIndex = parent.childIds.indexOf(node.id)
    const originalSubtree = snapshotSubtree(store.graph, node.id)
    const prevSelection = new Set(store.state.selectedIds)

    const frame = store.graph.createNode('FRAME', parentId, {
      name: node.name,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      fills: []
    })
    const frameId = frame.id

    for (const [index, path] of vectorized.paths.entries()) {
      store.graph.createNode('VECTOR', frame.id, {
        name: `path ${index + 1}`,
        x: 0,
        y: 0,
        width: node.width,
        height: node.height,
        vectorNetwork: path.vectorNetwork,
        fills: path.fills,
        strokes: path.strokes
      })
    }

    const frameSubtree = snapshotSubtree(store.graph, frameId)
    store.graph.deleteNode(node.id)
    store.select([frameId])

    store.undo.push({
      label: 'Vectorize image',
      forward: () => {
        if (store.graph.getNode(node.id)) store.graph.deleteNode(node.id)
        const frameRoot = frameSubtree.get(frameId)
        if (frameRoot && !store.graph.getNode(frameId)) {
          restoreSubtree(store.graph, frameRoot, parentId, frameSubtree)
          store.graph.insertChildAt(frameId, parentId, insertIndex)
        }
        store.select([frameId])
      },
      inverse: () => {
        for (const id of [...frameSubtree.keys()].reverse()) {
          if (store.graph.getNode(id)) store.graph.deleteNode(id)
        }
        const originalRoot = originalSubtree.get(node.id)
        if (originalRoot && !store.graph.getNode(node.id)) {
          restoreSubtree(store.graph, originalRoot, parentId, originalSubtree)
          store.graph.insertChildAt(node.id, parentId, insertIndex)
        }
        store.select([...prevSelection])
      }
    })

    store.requestRender()
    toast.info('Image converted to vectors')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vectorization failed'
    toast.error(message)
  } finally {
    vectorizeInFlight = false
  }
}
