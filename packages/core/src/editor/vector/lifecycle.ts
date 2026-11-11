import type { SceneGraph } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { cloneVectorNetwork } from '@open-pencil/scene-graph/copy'
import { slotScope } from '@open-pencil/scene-graph/slots'
import {
  transformVectorNetwork,
  vectorNetworksEqual
} from '@open-pencil/scene-graph/vector-network'

import { getNodeEditCapability } from '#core/editor/capabilities'
import type { EditorContext } from '#core/editor/types'
import { vectorChangesFromPagePath } from '#core/vector'

import { createVectorEditHistory } from './history'
import { getLiveNetwork, setNodeEditNetwork } from './network'
import type {
  NodeEditExitOptions,
  NodeEditOptions,
  NodeEditState,
  VectorEditActionDeps
} from './types'

// Always read ctx.graph at call time: opening a file swaps the graph
// instance (editor.replaceGraph), so a captured reference goes stale.
//
// Edit-state geometry lives in page-absolute space, mapped through the node's
// full world matrix so nested, rotated, and flipped nodes edit correctly.
export function createVectorEditLifecycle(ctx: EditorContext, actions: VectorEditActionDeps) {
  function getNodeEditState() {
    return ctx.state.nodeEditState
  }

  /** The document the open path belongs to; a session never commits into another one. */
  let sessionGraph: SceneGraph | null = null

  // A path whose layer is gone, by undo, a script, or another document, has nothing to edit.
  const close = () => {
    ctx.state.nodeEditState = null
    sessionGraph = null
    ctx.state.snapGuides = []
    ctx.requestRender()
  }
  ctx.onEditorEvent('node:deleted', (id) => {
    if (ctx.state.nodeEditState?.nodeId === id) close()
  })
  ctx.onEditorEvent('graph:replaced', () => {
    if (ctx.state.nodeEditState) close()
  })
  // Figma desktop 126: selecting another layer, such as in the layers panel, leaves vector edit
  // mode and keeps what was edited.
  ctx.onEditorEvent('selection:changed', (selectedIds) => {
    const es = ctx.state.nodeEditState
    if (!es || selectedIds.includes(es.nodeId)) return
    // Replacing the document clears the selection before it says so: drop the path, not commit it.
    if (ctx.graph !== sessionGraph) close()
    // A path the host keeps open keeps its layer selected while its page is shown; switching to
    // another page ends it, as the layer is no longer on the canvas.
    else if (es.keepOpen && ctx.graph.pageOf(es.nodeId) === ctx.state.currentPageId)
      actions.select([es.nodeId])
    else exitNodeEditMode(true, { release: true })
  })

  /** Takes the layer's path as the one committed, which the next change starts from. */
  function takeLayerAsCommitted(es: NodeEditState): boolean {
    const layer = ctx.graph.getNode(es.nodeId)
    if (layer?.type !== 'VECTOR' || !layer.vectorNetwork) return false
    es.origNetwork = cloneVectorNetwork(layer.vectorNetwork)
    es.origBounds = { x: layer.x, y: layer.y, width: layer.width, height: layer.height }
    es.origAbsNetwork = transformVectorNetwork(
      getWorldMatrix(layer, ctx.graph),
      layer.vectorNetwork
    )
    return true
  }

  function commitNodeEditChanges(es: NodeEditState) {
    es.changeStart = null
    const node = ctx.graph.getNode(es.nodeId)
    if (node?.type !== 'VECTOR') return

    // Session geometry only changes through explicit edits, so an exact
    // comparison detects a no-op session — skip it to keep undo clean.
    if (vectorNetworksEqual(getLiveNetwork(es), es.origAbsNetwork)) return

    const changes = vectorChangesFromPagePath(ctx.graph, node, getLiveNetwork(es))
    if (!changes) return
    actions.updateNodeWithUndo(node.id, changes, 'Edit vector')
    takeLayerAsCommitted(es)
    ctx.requestRender()
  }

  const history = createVectorEditHistory(ctx, commitNodeEditChanges)

  // Undo and redo change the layer, and the path open on it shows what they made of it. Indices
  // may no longer exist there, so nothing stays selected in it.
  ctx.onEditorEvent('node:updated', (id, changes) => {
    const es = ctx.state.nodeEditState
    if (es?.nodeId !== id || !ctx.undo.isReplaying || !('vectorNetwork' in changes)) return
    if (!takeLayerAsCommitted(es)) return
    setNodeEditNetwork(es, es.origAbsNetwork)
    es.selectedVertexIndices = new Set()
    es.selectedSegmentIndices = new Set()
    es.selectedRegions = new Set()
    es.selectedHandles = new Set()
    es.hoveredHandleInfo = null
    ctx.requestRender()
  })

  /**
   * Opening and leaving a path are undo steps, as in Figma: undo past a session's first change
   * leaves it, and undo after leaving opens the path again. A path the host keeps open is the
   * host's to open and end, so it records neither.
   */
  function recordSession(label: string, nodeId: string, opens: boolean, options: NodeEditOptions) {
    if (options.keepOpen || ctx.undo.isReplaying) return
    const open = () => {
      if (ctx.state.nodeEditState?.nodeId !== nodeId) openSession(nodeId, options)
    }
    const leave = () => {
      if (ctx.state.nodeEditState?.nodeId === nodeId) close()
    }
    ctx.undo.push({ label, forward: opens ? open : leave, inverse: opens ? leave : open })
  }

  function enterNodeEditMode(nodeId: string, options: NodeEditOptions = {}) {
    if (openSession(nodeId, options)) recordSession('Enter path', nodeId, true, options)
  }

  function openSession(nodeId: string, options: NodeEditOptions): boolean {
    const node = ctx.graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return false
    // A vector inside an instance draws its component's path, so Figma does not open it.
    if (node.parentId && slotScope(ctx.graph, node.parentId).kind === 'locked') return false
    // A library's own layers change in the library, not in a document that uses them.
    if (!getNodeEditCapability(ctx.graph, nodeId).editable) return false
    // The path already open stays as edited; another one is committed before this one opens.
    const open = ctx.state.nodeEditState
    if (open?.nodeId === nodeId) return false
    // A path the host keeps open stays the one being edited until the host releases it.
    if (open?.keepOpen) return false
    if (open) exitNodeEditMode(true)
    // A pen path in progress, maybe continuing this very layer, is committed before the session
    // takes the layer's geometry as its starting point.
    if (ctx.state.penState) actions.penCommit(false)
    // The layer as it stands now, with what the pen just committed.
    const layer = ctx.graph.getNode(nodeId)
    if (layer?.type !== 'VECTOR' || !layer.vectorNetwork) return false

    const world = getWorldMatrix(layer, ctx.graph)
    const absNetwork = transformVectorNetwork(world, layer.vectorNetwork)

    ctx.state.snapGuides = []
    sessionGraph = ctx.graph
    ctx.state.nodeEditState = {
      nodeId,
      keepOpen: options.keepOpen ?? false,
      showHandles: options.showHandles ?? 'near-selection',
      origNetwork: cloneVectorNetwork(layer.vectorNetwork),
      origBounds: { x: layer.x, y: layer.y, width: layer.width, height: layer.height },
      origAbsNetwork: cloneVectorNetwork(absNetwork),
      vertices: absNetwork.vertices,
      segments: absNetwork.segments,
      regions: absNetwork.regions,
      changeStart: null,
      selectedVertexIndices: new Set(),
      selectedSegmentIndices: new Set(),
      draggedHandleInfo: null,
      selectedHandles: new Set(),
      hoveredHandleInfo: null,
      hoveredRegion: null,
      selectedRegions: new Set()
    }

    actions.select([nodeId])
    ctx.requestRender()
    return true
  }

  /**
   * Leaves vector edit mode, keeping the edit or putting the path back. A path the host keeps open
   * stays open unless `release` is given.
   */
  function exitNodeEditMode(commit: boolean, options: NodeEditExitOptions = {}) {
    const es = getNodeEditState()
    if (!es || (es.keepOpen && !options.release)) return
    ctx.state.snapGuides = []
    ctx.requestRender()

    const node = ctx.graph.getNode(es.nodeId)
    if (node?.type !== 'VECTOR') {
      ctx.state.nodeEditState = null
      sessionGraph = null
      ctx.requestRender()
      return
    }

    // Undo and redo leave the layer as their step had it, with nothing to commit or put back.
    const replaying = ctx.undo.isReplaying
    if (commit && !replaying) {
      commitNodeEditChanges(es)
    } else if (!replaying) {
      ctx.graph.updateNode(es.nodeId, {
        x: es.origBounds.x,
        y: es.origBounds.y,
        width: es.origBounds.width,
        height: es.origBounds.height,
        vectorNetwork: cloneVectorNetwork(es.origNetwork)
      })
      ctx.requestRender()
    }

    ctx.state.nodeEditState = null
    sessionGraph = null
    recordSession('Leave path', es.nodeId, false, es)
  }

  return {
    getNodeEditState,
    commitNodeEditChanges,
    enterNodeEditMode,
    exitNodeEditMode,
    history
  }
}
