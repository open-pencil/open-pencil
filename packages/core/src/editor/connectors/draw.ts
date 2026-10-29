import type { ConnectorEndpoint } from '@open-pencil/scene-graph'
import { createConnector, layoutConnector } from '@open-pencil/scene-graph/connectors'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import {
  connectorAttachment,
  type AttachModifiers,
  type ConnectorTarget
} from '#core/editor/connectors/attach'
import type { NodePreview } from '#core/editor/node-preview'
import type { EditorContext } from '#core/editor/types'
import { pushCreatedSubtreesUndo } from '#core/editor/undo'

/** A connector being drawn: where it started, and the layer made once the pointer moved. */
interface ConnectorDraft {
  start: ConnectorEndpoint
  connectorId: string | null
  previousSelection: Set<string>
  /** Set once a click placed the start: the line then follows the pointer to the next click. */
  clicked: boolean
}

/**
 * The connector tool, as FigJam's draws: press on a layer or the canvas and drag to where the
 * connector ends, or click its start and then its end. Each end attaches to the layer under it by
 * the magnet its position picks, or stays free. A new connector has no start cap and an arrow at
 * its end, and the tool stays active.
 */
export function createConnectorDrawActions(ctx: EditorContext) {
  let draft: ConnectorDraft | null = null

  function setTarget(target: ConnectorTarget | null) {
    ctx.state.connectorTarget = target
    ctx.requestRepaint()
  }

  function attach(point: Vector, modifiers: AttachModifiers, connectorId?: string) {
    return connectorAttachment(ctx.graph, ctx.state.currentPageId, point, {
      zoom: ctx.state.zoom,
      connectorId,
      ...modifiers
    })
  }

  /** Outlines the layer a connector end at `point` would attach to; a clicked start follows. */
  function connectorHover(x: number, y: number, modifiers: AttachModifiers = {}) {
    if (draft?.clicked) connectorDrag(x, y, modifiers)
    else setTarget(attach({ x, y }, modifiers).target)
  }

  /** Starts a connector at `point`, or ends the one a click started. */
  function connectorBegin(x: number, y: number, modifiers: AttachModifiers = {}) {
    if (draft) return
    draft = {
      start: attach({ x, y }, modifiers).endpoint,
      connectorId: null,
      previousSelection: new Set(ctx.state.selectedIds),
      clicked: false
    }
  }

  function connectorDrag(x: number, y: number, modifiers: AttachModifiers = {}) {
    if (!draft) return
    const { endpoint, target } = attach({ x, y }, modifiers, draft.connectorId ?? undefined)
    setTarget(target)
    const graph = ctx.graph
    if (!draft.connectorId) {
      const connector = createConnector(graph, ctx.state.currentPageId, {
        start: draft.start,
        end: endpoint,
        startCap: 'NONE',
        endCap: 'ARROW_LINES'
      })
      draft.connectorId = connector.id
      // Lays out the label, which loads its font, as a placed sticky note's text does.
      ctx.runLayoutForNode(connector.id)
      ctx.setSelectedIds(new Set())
    } else {
      graph.updateNode(draft.connectorId, { connectorEnd: endpoint })
      const connector = graph.getNode(draft.connectorId)
      if (connector) layoutConnector(graph, connector)
    }
    ctx.requestRender()
  }

  /**
   * Ends the connector at `point`. A release where the press was, with nothing drawn yet, leaves
   * the start waiting for a second click.
   */
  function connectorRelease(x: number, y: number, moved: boolean, modifiers: AttachModifiers = {}) {
    if (!draft) return
    if (!draft.connectorId && !moved && !draft.clicked) {
      draft.clicked = true
      return
    }
    connectorDrag(x, y, modifiers)
    const { connectorId, previousSelection } = draft
    draft = null
    setTarget(null)
    if (!connectorId || !ctx.graph.getNode(connectorId)) return
    pushCreatedSubtreesUndo(ctx, 'Create connector', [connectorId], previousSelection)
    ctx.setSelectedIds(new Set())
    ctx.requestRender()
  }

  function connectorCancel() {
    const current = draft
    draft = null
    setTarget(null)
    if (current?.connectorId) {
      ctx.graph.deleteNode(current.connectorId)
      // Drawing cleared the selection; giving it up gives the selection back.
      ctx.setSelectedIds(new Set(current.previousSelection))
    }
    ctx.requestRender()
  }

  // Another tool leaves a connector a click started unfinished.
  ctx.onEditorEvent('tool:changed', () => {
    if (draft) connectorCancel()
  })

  return { connectorHover, connectorBegin, connectorDrag, connectorRelease, connectorCancel }
}

type BeginNodePreview = (label?: string) => NodePreview

/**
 * Dragging an end of a selected connector, as Figma does: the end follows the pointer, attaches
 * to the layer under it by the magnet its position picks, or pinned or centred as the keys held
 * say, and the connector routes as it goes. One undo step puts the end back.
 */
export function createConnectorEndpointActions(
  ctx: EditorContext,
  beginNodePreview: BeginNodePreview,
  deleteNodes: (nodeIds: Iterable<string>) => void
) {
  let drag: {
    connectorId: string
    end: 'connectorStart' | 'connectorEnd'
    /** The layer the dragged end joined when the drag began. */
    joined: string | null
    preview: NodePreview
  } | null = null

  function connectorEndpointBegin(connectorId: string, end: 'connectorStart' | 'connectorEnd') {
    connectorEndpointCancel()
    const joined = ctx.graph.getNode(connectorId)?.[end]?.nodeId ?? null
    drag = { connectorId, end, joined, preview: beginNodePreview('Move connector end') }
  }

  function connectorEndpointDrag(x: number, y: number, modifiers: AttachModifiers = {}) {
    if (!drag) return
    const connector = ctx.graph.getNode(drag.connectorId)
    if (!connector) return
    const { endpoint, target } = connectorAttachment(
      ctx.graph,
      ctx.state.currentPageId,
      { x, y },
      {
        zoom: ctx.state.zoom,
        straight: connector.connectorLineType === 'STRAIGHT',
        connectorId: connector.id,
        ...modifiers
      }
    )
    ctx.state.connectorTarget = target
    drag.preview.update(connector.id, { [drag.end]: endpoint })
  }

  function connectorEndpointCommit() {
    const current = drag
    drag = null
    ctx.state.connectorTarget = null
    const connector = current ? ctx.graph.getNode(current.connectorId) : undefined
    const dropped = current && connector ? connector[current.end]?.nodeId : null
    const other = current?.end === 'connectorStart' ? 'connectorEnd' : 'connectorStart'
    if (
      current &&
      connector &&
      dropped &&
      dropped !== current.joined &&
      dropped === connector[other]?.nodeId
    ) {
      // FigJam deletes a connector whose end is dropped on the layer its other end joins.
      current.preview.cancel()
      deleteNodes([connector.id])
    } else {
      current?.preview.commit()
    }
    ctx.requestRender()
  }

  function connectorEndpointCancel() {
    const current = drag
    drag = null
    ctx.state.connectorTarget = null
    current?.preview.cancel()
    ctx.requestRender()
  }

  return {
    connectorEndpointBegin,
    connectorEndpointDrag,
    connectorEndpointCommit,
    connectorEndpointCancel
  }
}
