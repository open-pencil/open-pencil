import { tryOnScopeDispose } from '@vueuse/core'

import { getNodeEditCapability, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { layerResizes } from '@open-pencil/scene-graph/generated'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import {
  applyResizedRect,
  cancelResizePreview,
  commitResizePreview,
  scaledChanges
} from '#vue/shared/input/resize'
import { createResizeDrag } from '#vue/shared/input/resize/start'
import type { DragResize } from '#vue/shared/input/types'

type Size = Pick<Rect, 'width' | 'height'>

/** Whether a typed size moves layers inside: a frame, group, or instance a handle could resize. */
function sizesLayersInside(node: SceneNode): boolean {
  return node.childIds.length > 0 && layerResizes(node)
}

/**
 * The W and H fields' edits. Layers with layers inside resize as a handle drag resizes them: each
 * keeps its corner, and the layers inside follow their constraints from where the edit began, as
 * in Figma. Other layers take the size through the caller's own preview. A multi-selection
 * commits as one undo step.
 *
 * An edit is put back when its selection, page, or document goes away under it, as a node preview
 * is; the rest of that scrub then changes nothing until the field commits or cancels.
 */
export function usePanelSize(editor: Editor) {
  let edits: DragResize[] | null = null
  /** The document the edit began in. A document loaded over it ends the edit, touching neither. */
  let graph: Editor['graph'] | null = null
  let stopListening: (() => void)[] = []
  let interrupted = false

  function interrupt() {
    cancel()
    interrupted = true
  }

  function cancelOnLeave(current: readonly DragResize[]) {
    stopListening = [
      ...(['selection:changed', 'page:changed', 'graph:replaced'] as const).map((event) =>
        editor.onEditorEvent(event, interrupt)
      ),
      editor.onEditorEvent('node:deleted', (id) => {
        if (current.some((edit) => edit.nodeId === id || edit.origChildren?.has(id))) interrupt()
      })
    ]
  }

  /** Whether the layer and every layer its resize moves can be edited. */
  function editable(edit: DragResize): boolean {
    return [edit.nodeId, ...(edit.origChildren?.keys() ?? [])].every(
      (id) => getNodeEditCapability(editor.graph, id).editable
    )
  }

  /** Opens resizes for `nodes`, or refuses the whole edit when any layer it moves is read-only. */
  function begin(nodes: readonly SceneNode[]): DragResize[] | null {
    // The panel holds copies of the selection, so each resize starts from the open document's.
    const live = nodes.flatMap((node) => editor.graph.getNode(node.id) ?? [])
    const started = live.map((node) => createResizeDrag(node, 'se', 0, 0, editor))
    if (started.length === 0) return null
    // Refused before anything moves, as the commit would refuse it after.
    if (!started.every(editable)) {
      interrupted = true
      return null
    }
    graph = editor.graph
    cancelOnLeave(started)
    return started
  }

  /**
   * Gives `nodes` the typed width or height, or both, from their size when the edit began. When
   * any of them has no layers inside, `fallback` takes the value instead.
   */
  function update(nodes: readonly SceneNode[], size: Partial<Size>, fallback: () => void) {
    if (interrupted) return
    if (!edits) {
      if (!nodes.every(sizesLayersInside)) {
        fallback()
        return
      }
      edits = begin(nodes)
      if (!edits) return
    }
    for (const edit of edits) {
      const node = editor.graph.getNode(edit.nodeId)
      if (!node) continue
      const rect = { ...edit.origRect, ...size }
      applyResizedRect(edit, node, rect, scaledChanges(edit, node.type, rect), editor)
    }
    editor.requestRepaint()
  }

  /** Ends the edit, handing back its resizes while they still belong to the open document. */
  function end(): DragResize[] {
    const current = graph === editor.graph ? edits : null
    edits = null
    graph = null
    for (const stop of stopListening) stop()
    stopListening = []
    return current ?? []
  }

  function commit() {
    interrupted = false
    const current = end()
    if (current.length === 0) return
    editor.undo.runBatch('Resize', () => {
      for (const edit of current) commitResizePreview(edit, editor)
    })
  }

  function cancel() {
    interrupted = false
    const current = end()
    for (const edit of current) cancelResizePreview(edit, editor)
    if (current.length > 0) editor.requestRepaint()
  }

  tryOnScopeDispose(cancel)
  return { update, commit, cancel }
}
