import type { CanvasKit, SkPicture } from 'canvaskit-wasm'
import { uniq } from 'es-toolkit/array'
import { watch } from 'vue'

import {
  recordJSXPreview,
  stageJSXPreview,
  type StagedJSXPreview
} from '@open-pencil/core/design-jsx'
import { computeContentBounds } from '@open-pencil/core/io'
import type { JSXPreviewNode } from '@open-pencil/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import {
  getActiveEditorStoreOrNull,
  useActiveEditorStoreRef,
  type EditorStore
} from '@/app/editor/active-store'
import { MAX_OUTLINE } from '@/app/presence/schema'

import { createJSXPreviewController, type PreviewArtifact } from './controller'
import type { RenderPreviewInput } from './input'

interface PreviewTarget {
  graph: SceneGraph
  pageId: string
}

const MAX_RENDERED_PREVIEW_NODES = 500

/** Where streamed JSX is being built, in world coordinates: its newest element, and outlines. */
export interface PreviewFocus {
  cursor: Vector
  outline: Rect[]
}

function nodeRect(graph: SceneGraph, nodeId: string): Rect | null {
  const bounds = computeContentBounds(graph, [nodeId])
  if (!bounds) return null
  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY
  }
}

/** The element that appeared last: the source's last element is the end of the last-child chain. */
function newestElement(graph: SceneGraph, rootIds: readonly string[]): string | undefined {
  const rootId = rootIds.at(-1)
  let node = rootId ? graph.getNode(rootId) : undefined
  while (node) {
    const last = node.childIds.at(-1)
    const child = last ? graph.getNode(last) : undefined
    if (!child) return node.id
    node = child
  }
  return undefined
}

/** The cursor at the newest element's trailing corner, and outlines of the JSX and that element. */
export function previewFocus(staged: Pick<StagedJSXPreview, 'graph' | 'renderedIds'>) {
  const newest = newestElement(staged.graph, staged.renderedIds)
  const newestRect = newest ? nodeRect(staged.graph, newest) : null
  if (!newest || !newestRect) return null
  const outlined = uniq([...staged.renderedIds, newest]).slice(-MAX_OUTLINE)
  const outline = outlined.flatMap((id) => nodeRect(staged.graph, id) ?? [])
  // The trailing corner, where content grows, so the agent's name sits beside what it writes.
  const cursor = { x: newestRect.x + newestRect.width, y: newestRect.y + newestRect.height }
  return { cursor, outline } satisfies PreviewFocus
}

function countNodes(tree: JSXPreviewNode): number {
  return (
    1 +
    tree.children.reduce(
      (count, child) => count + (typeof child === 'string' ? 0 : countNodes(child)),
      0
    )
  )
}

export interface CanvasJSXPreviewOptions {
  /** Told where each shown preview is being built, so the agent can point there. */
  onFocus?: (focus: PreviewFocus) => void
  /**
   * Show previews only while this document is the active tab, and drop them when another tab
   * becomes active, as the chat's own preview does. A room shows its peers' previews whenever
   * the document's canvas is drawn, which is also true of several documents on one page.
   */
  activeTabOnly?: boolean
}

/**
 * Bind speculative pictures to this editor. Previews belong to `pageId()`, the run's page:
 * the renderer shows them only while that page is on screen, so page switches hide them.
 */
export function createCanvasJSXPreview(
  store: EditorStore,
  pageId: () => string,
  { onFocus, activeTabOnly = true }: CanvasJSXPreviewOptions = {}
) {
  let subscriptions: (() => void)[] = []

  const isShown = () => !activeTabOnly || getActiveEditorStoreOrNull() === store

  function isCurrent(target: PreviewTarget): boolean {
    return (
      isShown() &&
      store.graph === target.graph &&
      store.graph.getNode(target.pageId)?.type === 'CANVAS'
    )
  }

  function unsubscribe(): void {
    for (const stop of subscriptions) stop()
    subscriptions = []
  }

  function capture(): PreviewTarget | null {
    if (!isShown() || !store.renderer) return null
    if (subscriptions.length === 0) {
      subscriptions = [
        store.onEditorEvent('graph:replaced', () => controller.clear()),
        // Edits, including an earlier render call committing, restage previews on the new document.
        store.onEditorEvent('node:created', () => controller.invalidate()),
        store.onEditorEvent('node:updated', () => controller.invalidate()),
        store.onEditorEvent('node:deleted', () => controller.invalidate()),
        store.onEditorEvent('node:reparented', () => controller.invalidate()),
        store.onEditorEvent('node:reordered', () => controller.invalidate())
      ]
      if (activeTabOnly) {
        subscriptions.push(
          watch(
            useActiveEditorStoreRef(),
            (active) => {
              if (active !== store) controller.clear()
            },
            { flush: 'sync' }
          )
        )
      }
    }
    return { graph: store.graph, pageId: pageId() }
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
    const focus = previewFocus(staged)
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
        if (focus) onFocus?.(focus)
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
