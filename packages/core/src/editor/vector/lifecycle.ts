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

import { getLiveNetwork } from './network'
import type { VectorEditActionDeps } from './types'

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
    else exitNodeEditMode(true)
  })

  function commitNodeEditChanges(es: NonNullable<typeof ctx.state.nodeEditState>) {
    const node = ctx.graph.getNode(es.nodeId)
    if (node?.type !== 'VECTOR') return

    // Session geometry only changes through explicit edits, so an exact
    // comparison detects a no-op session — skip it to keep undo clean.
    if (vectorNetworksEqual(getLiveNetwork(es), es.origAbsNetwork)) return

    const changes = vectorChangesFromPagePath(ctx.graph, node, getLiveNetwork(es))
    if (!changes) return
    actions.updateNodeWithUndo(node.id, changes, 'Edit vector')
    const committed = ctx.graph.getNode(es.nodeId)
    if (committed?.type === 'VECTOR' && committed.vectorNetwork) {
      const committedWorld = getWorldMatrix(committed, ctx.graph)
      es.origNetwork = cloneVectorNetwork(committed.vectorNetwork)
      es.origBounds = {
        x: committed.x,
        y: committed.y,
        width: committed.width,
        height: committed.height
      }
      es.origAbsNetwork = cloneVectorNetwork(
        transformVectorNetwork(committedWorld, committed.vectorNetwork)
      )
    }
    ctx.requestRender()
  }

  function enterNodeEditMode(nodeId: string) {
    const node = ctx.graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return
    // A vector inside an instance draws its component's path, so Figma does not open it.
    if (node.parentId && slotScope(ctx.graph, node.parentId).kind === 'locked') return
    // A library's own layers change in the library, not in a document that uses them.
    if (!getNodeEditCapability(ctx.graph, nodeId).editable) return
    // The path already open stays as edited; another one is committed before this one opens.
    const open = ctx.state.nodeEditState
    if (open?.nodeId === nodeId) return
    if (open) exitNodeEditMode(true)
    // A pen path in progress, maybe continuing this very layer, is committed before the session
    // takes the layer's geometry as its starting point.
    if (ctx.state.penState) actions.penCommit(false)
    // The layer as it stands now, with what the pen just committed.
    const layer = ctx.graph.getNode(nodeId)
    if (layer?.type !== 'VECTOR' || !layer.vectorNetwork) return

    const world = getWorldMatrix(layer, ctx.graph)
    const absNetwork = transformVectorNetwork(world, layer.vectorNetwork)

    ctx.state.snapGuides = []
    sessionGraph = ctx.graph
    ctx.state.nodeEditState = {
      nodeId,
      origNetwork: cloneVectorNetwork(layer.vectorNetwork),
      origBounds: { x: layer.x, y: layer.y, width: layer.width, height: layer.height },
      origAbsNetwork: cloneVectorNetwork(absNetwork),
      vertices: absNetwork.vertices,
      segments: absNetwork.segments,
      regions: absNetwork.regions,
      history: [],
      future: [],
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
  }

  function exitNodeEditMode(commit: boolean) {
    const es = getNodeEditState()
    if (!es) return
    ctx.state.snapGuides = []
    ctx.requestRender()

    const node = ctx.graph.getNode(es.nodeId)
    if (node?.type !== 'VECTOR') {
      ctx.state.nodeEditState = null
      sessionGraph = null
      ctx.requestRender()
      return
    }

    if (commit) {
      commitNodeEditChanges(es)
    } else {
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
  }

  return { getNodeEditState, commitNodeEditChanges, enterNodeEditMode, exitNodeEditMode }
}
