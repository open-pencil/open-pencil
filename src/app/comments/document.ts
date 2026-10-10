import { ref, watch, type Ref } from 'vue'

import {
  commentPosition,
  commentTimestamp as now,
  editCommentThread,
  hasNewerComments,
  mergeCommentThreads,
  readComments,
  writeComments,
  type CommentThread
} from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'

/**
 * The comments of whichever document `storeRef` holds: read from it, written to it, and kept in
 * step with collaborators and with the layers pins sit on. `onDocumentChange` runs when another
 * document's comments take their place.
 */
export function followDocumentComments(
  storeRef: Ref<EditorStore | undefined>,
  onDocumentChange: () => void
) {
  const threads = ref<CommentThread[]>([])
  // Where each pinned thread's layer last put it, kept as layers change rather than as pins are
  // drawn, so a pin whose layer is deleted, even unseen, stays where the layer was.
  const lastSeen = new Map<string, Vector>()
  let bound: EditorStore | null = null
  let unsubscribe: (() => void) | null = null
  let reconcileQueued = false

  function rememberPositions() {
    if (!bound) return
    for (const thread of threads.value) {
      if (thread.deleted || !thread.nodeId || !bound.graph.getNode(thread.nodeId)) continue
      lastSeen.set(thread.id, commentPosition(bound.graph, thread))
    }
  }

  function show(next: CommentThread[]) {
    threads.value = next
    rememberPositions()
  }

  /**
   * The document's comments changed under this session. A collaborator's save replaces them
   * whole, so when two people comment at once one copy wins; whatever this session had that the
   * winning copy lacks is merged back in and written again.
   */
  function reconcile() {
    if (!bound) return
    const incoming = readComments(bound.graph)
    if (!hasNewerComments(threads.value, incoming)) {
      show(incoming)
      return
    }
    const merged = mergeCommentThreads(threads.value, incoming)
    writeComments(bound.graph, merged)
    show(merged)
  }

  function queueReconcile() {
    if (reconcileQueued) return
    reconcileQueued = true
    queueMicrotask(() => {
      reconcileQueued = false
      reconcile()
    })
  }

  /** Change the open document's comments, starting from what it holds now. */
  function mutate(change: (current: CommentThread[]) => CommentThread[]) {
    if (!bound) return
    const next = change(readComments(bound.graph))
    writeComments(bound.graph, next)
    show(next)
  }

  function update(id: string, edit: (thread: CommentThread) => CommentThread) {
    mutate((current) => editCommentThread(current, id, now(), edit))
  }

  /** The layer a pin followed is gone: the pin stays where it was last seen, on the canvas. */
  function detachFromLayer(nodeId: string) {
    if (!threads.value.some((thread) => thread.nodeId === nodeId)) return
    mutate((current) =>
      current.map((thread) => {
        if (thread.nodeId !== nodeId) return thread
        const at = lastSeen.get(thread.id) ?? { x: thread.x, y: thread.y }
        return { ...thread, nodeId: null, x: at.x, y: at.y, updatedAt: now() }
      })
    )
  }

  function replaceDocument() {
    lastSeen.clear()
    onDocumentChange()
    show(bound ? readComments(bound.graph) : [])
  }

  function bind(store: EditorStore | undefined) {
    if ((store ?? null) === bound) return
    unsubscribe?.()
    unsubscribe = null
    bound = store ?? null
    replaceDocument()
    if (!store) return
    const stops = [
      // Comments change on the document node: here, from a collaborator, or by a tool.
      store.onEditorEvent('node:updated', (id) => {
        if (id === store.graph.rootId) queueReconcile()
        else rememberPositions()
      }),
      store.onEditorEvent('node:reparented', rememberPositions),
      // A collaboration room can bring its own document node, with its own comments.
      store.onEditorEvent('node:created', (node) => {
        if (node.parentId === null) queueMicrotask(() => show(readComments(store.graph)))
      }),
      store.onEditorEvent('node:deleted', (id) => queueMicrotask(() => detachFromLayer(id))),
      store.onEditorEvent('graph:replaced', replaceDocument)
    ]
    unsubscribe = () => {
      for (const stop of stops) stop()
    }
  }

  // Setting the active store retriggers it even when it is the same one, as panes take turns.
  watch(storeRef, bind, { immediate: true, flush: 'sync' })

  return {
    threads,
    /** The document comments are read from and written to now. */
    store: () => bound,
    mutate,
    update,
    pinPosition: (thread: CommentThread): Vector =>
      bound ? commentPosition(bound.graph, thread) : { x: thread.x, y: thread.y }
  }
}
