import { isEqual, pick } from 'es-toolkit'

import {
  connectorRouteEnds,
  freeEndpoint,
  generatedFrameOwner,
  layoutConnector,
  SIZE_FIELDS,
  TRANSFORM_FIELDS,
  type ConnectorEndpoint,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorContext } from '#core/editor/types'
import { routeUnroutedConnectors } from '#core/layout'

/** Fields of any layer that move a connector attached to it or to a layer inside it. */
const PLACEMENT_FIELDS: ReadonlySet<string> = new Set<string>([
  ...TRANSFORM_FIELDS,
  ...SIZE_FIELDS,
  'parentId'
])

/** A connector's own fields that change its route. */
const CONNECTOR_FIELDS: ReadonlySet<string> = new Set<keyof SceneNode>([
  'connectorStart',
  'connectorEnd',
  'connectorLineType',
  'connectorStartCap',
  'connectorEndCap'
])

/** Fields of a connector's sublayers that change its route: the line's weight, the label's size. */
const SUBLAYER_FIELDS: ReadonlySet<string> = new Set<string>([
  ...SIZE_FIELDS,
  'text',
  'strokes',
  'strokeWeight'
])

/**
 * A connector moved as a whole takes its free ends along: they stay where its line now draws
 * them, as a pasted or dragged connector's do in FigJam. Ends on layers follow their layers.
 */
function carryFreeEnds(
  graph: SceneGraph,
  connector: SceneNode,
  update: (id: string, changes: Partial<SceneNode>) => void
) {
  const drawn = connectorRouteEnds(graph, connector)
  if (!drawn) return
  const carried = (endpoint: ConnectorEndpoint | null, at: Vector) =>
    endpoint?.nodeId === null ? freeEndpoint(at.x, at.y) : endpoint
  const changes = {
    connectorStart: carried(connector.connectorStart, drawn.start),
    connectorEnd: carried(connector.connectorEnd, drawn.end)
  }
  if (!isEqual(changes, pick(connector, ['connectorStart', 'connectorEnd']))) {
    update(connector.id, changes)
  }
}

/** Whether `id` or a layer above it is one of `ids`. */
function underAny(graph: SceneGraph, id: string, ids: ReadonlySet<string>): boolean {
  return graph.closest(id, (node) => ids.has(node.id)) !== undefined
}

/**
 * Keeps connectors routed as the layers they attach to move, resize, or change, as FigJam does:
 * while a drag previews, and when an edit, undo, or redo lands. A route derives from the layers,
 * so it is laid out again rather than recorded; loading a document keeps the routes it saved,
 * though a label its fonts resize moves its plate, and routes a connector it saved without one
 * once the page it is on is shown.
 */
export function createConnectorRouting(ctx: EditorContext) {
  let indexed: SceneGraph | null = null
  const connectorIds = new Set<string>()
  /**
   * Layers changed since the last pass, connectors moved as a whole, and whether any change was
   * more than a preview.
   */
  let pending: { ids: Set<string>; moved: Set<string>; committed: boolean } | null = null
  let routing = false

  function connectors(graph: SceneGraph): Set<string> {
    if (indexed !== graph) {
      indexed = graph
      connectorIds.clear()
      for (const node of graph.getAllNodes()) {
        if (node.type === 'CONNECTOR') connectorIds.add(node.id)
      }
    }
    return connectorIds
  }

  function schedule(id: string, committed: boolean) {
    if (routing || ctx.graph.isApplyingImportedState) return
    if (!pending) {
      pending = { ids: new Set(), moved: new Set(), committed: false }
      queueMicrotask(flush)
    }
    pending.ids.add(id)
    pending.committed ||= committed
  }

  function changed(id: string, changes: Partial<SceneNode>, committed: boolean) {
    const keys = Object.keys(changes)
    const node = ctx.graph.getNode(id)
    if (!node) return
    if (node.type === 'CONNECTOR' && keys.some((key) => CONNECTOR_FIELDS.has(key))) {
      schedule(id, committed)
      return
    }
    if (node.type === 'CONNECTOR' && (keys.includes('x') || keys.includes('y'))) {
      schedule(id, committed)
      pending?.moved.add(id)
      return
    }
    const owner = generatedFrameOwner(ctx.graph, node)
    if (owner?.type === 'CONNECTOR') {
      // A label laid out as its font loads moves its plate too.
      if (keys.some((key) => SUBLAYER_FIELDS.has(key))) schedule(owner.id, committed)
      return
    }
    // Laying out a page as it loads moves nothing a saved route depends on.
    if (ctx.graph.isApplyingDerivedLayout) return
    if (keys.some((key) => PLACEMENT_FIELDS.has(key))) schedule(id, committed)
  }

  function flush() {
    const batch = pending
    pending = null
    if (!batch) return
    const graph = ctx.graph
    const ids = connectors(graph)
    const affected: SceneNode[] = []
    for (const id of ids) {
      const connector = graph.getNode(id)
      if (!connector) {
        ids.delete(id)
        continue
      }
      const watched = [id, connector.connectorStart?.nodeId, connector.connectorEnd?.nodeId]
      if (watched.some((watchedId) => watchedId && underAny(graph, watchedId, batch.ids))) {
        affected.push(connector)
      }
    }
    if (affected.length === 0) return
    routing = true
    try {
      const update = batch.committed
        ? (id: string, changes: Partial<SceneNode>) =>
            graph.withLayoutMutations(() => graph.updateNode(id, changes))
        : (id: string, changes: Partial<SceneNode>) => graph.updateNodePreview(id, changes)
      let moved = false
      for (const connector of affected) {
        if (batch.moved.has(connector.id)) carryFreeEnds(graph, connector, update)
        moved = layoutConnector(graph, connector, update) || moved
      }
      if (moved) ctx.requestRender()
    } finally {
      routing = false
    }
  }

  // A document read without layout, as a `.fig` is, routes such connectors when shown.
  function routeShownPage(graph: SceneGraph, pageId: string) {
    graph.applyDerivedLayoutDuring(() => routeUnroutedConnectors(graph, pageId))
  }

  ctx.onEditorEvent('graph:replaced', (graph) => routeShownPage(graph, ctx.state.currentPageId))
  ctx.onEditorEvent('page:changed', (pageId) => routeShownPage(ctx.graph, pageId))
  ctx.onEditorEvent('node:updated', (id, changes) => changed(id, changes, true))
  ctx.onEditorEvent('node:previewUpdated', (id, changes) => changed(id, changes, false))
  ctx.onEditorEvent('node:created', (node) => {
    if (node.type === 'CONNECTOR' && indexed === ctx.graph) connectorIds.add(node.id)
  })
  ctx.onEditorEvent('node:reparented', (id) => schedule(id, true))
}
