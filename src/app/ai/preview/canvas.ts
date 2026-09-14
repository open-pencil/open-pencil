import type { CanvasKit, SkPicture } from 'canvaskit-wasm'
import { watch } from 'vue'

import {
  recordJSXPreview,
  stageJSXPreview,
  type JSXPreviewNode
} from '@open-pencil/core/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  getActiveEditorStoreOrNull,
  useActiveEditorStoreRef,
  type EditorStore
} from '@/app/editor/active-store'

import { createJSXPreviewController, type PreviewArtifact } from './controller'
import type { RenderPreviewInput } from './input'

interface PreviewTarget {
  graph: SceneGraph
  pageId: string
}

const MAX_RENDERED_PREVIEW_NODES = 500

function countNodes(tree: JSXPreviewNode): number {
  return (
    1 +
    tree.children.reduce(
      (count, child) => count + (typeof child === 'string' ? 0 : countNodes(child)),
      0
    )
  )
}

/** Bind speculative pictures to this editor only; document data is never mutated. */
export function createCanvasJSXPreview(store: EditorStore) {
  let subscriptions: (() => void)[] = []

  function isCurrent(target: PreviewTarget): boolean {
    return (
      getActiveEditorStoreOrNull() === store &&
      store.graph === target.graph &&
      store.state.currentPageId === target.pageId
    )
  }

  function unsubscribe(): void {
    for (const stop of subscriptions) stop()
    subscriptions = []
  }

  function capture(): PreviewTarget | null {
    if (getActiveEditorStoreOrNull() !== store || !store.renderer) return null
    if (subscriptions.length === 0) {
      subscriptions = [
        store.onEditorEvent('page:changed', () => controller.clear()),
        store.onEditorEvent('graph:replaced', () => controller.clear()),
        store.onEditorEvent('node:created', () => controller.clear()),
        store.onEditorEvent('node:updated', () => controller.clear()),
        store.onEditorEvent('node:deleted', () => controller.clear()),
        store.onEditorEvent('node:reparented', () => controller.clear()),
        store.onEditorEvent('node:reordered', () => controller.clear()),
        watch(
          useActiveEditorStoreRef(),
          (active) => {
            if (active !== store) controller.clear()
          },
          { flush: 'sync' }
        )
      ]
    }
    return { graph: store.graph, pageId: store.state.currentPageId }
  }

  async function build(
    target: PreviewTarget,
    tree: JSXPreviewNode,
    input: RenderPreviewInput,
    signal: AbortSignal
  ): Promise<PreviewArtifact | null> {
    if (countNodes(tree) > MAX_RENDERED_PREVIEW_NODES) return null
    const staged = await stageJSXPreview(target.graph, tree, input, target.pageId, signal)
    if (!staged) return null
    // Native Skia objects cannot cross CanvasKit instances, even within the same editor.
    const pictures = new Map<CanvasKit, SkPicture>()
    function deletePictures() {
      for (const picture of pictures.values()) picture.delete()
      pictures.clear()
    }
    try {
      for (const renderer of store.canvasRenderers) {
        if (pictures.has(renderer.ck)) continue
        const picture = await recordJSXPreview(renderer.ck, staged, signal)
        if (!picture) {
          deletePictures()
          return null
        }
        pictures.set(renderer.ck, picture)
      }
    } catch (error) {
      deletePictures()
      throw error
    }
    if (pictures.size === 0) return null
    const id = crypto.randomUUID()
    const attached = new Set<EditorStore['canvasRenderers'][number]>()
    let disposed = false
    return {
      show() {
        if (disposed || !isCurrent(target)) return
        for (const canvasRenderer of store.canvasRenderers) {
          const picture = pictures.get(canvasRenderer.ck)
          if (!picture) continue
          canvasRenderer.transientPreviews.set(id, {
            ...target,
            picture,
            replaceId: staged.replaceId,
            insertIndex: staged.insertIndex
          })
          attached.add(canvasRenderer)
        }
        store.requestRepaint()
      },
      dispose() {
        if (disposed) return
        disposed = true
        for (const canvasRenderer of attached) canvasRenderer.transientPreviews.delete(id)
        deletePictures()
        if (attached.size > 0) store.requestRepaint()
        attached.clear()
      }
    }
  }

  const controller = createJSXPreviewController({ capture, isCurrent, build, onIdle: unsubscribe })
  return controller
}
