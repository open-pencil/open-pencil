import { isEqual, pick } from 'es-toolkit'

import type { ConnectorEndpoint, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  connectorRouteEnds,
  connectorsAffectedBy,
  freeEndpoint,
  layoutConnector
} from '@open-pencil/scene-graph/connectors'
import { SIZE_FIELDS, TRANSFORM_FIELDS } from '@open-pencil/scene-graph/fields'
import { generatedFrameOwner } from '@open-pencil/scene-graph/generated'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import type { UndoEntry } from '@open-pencil/scene-graph/undo'

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
  'connectorEndCap',
  'connectorControlPoints',
  'connectorCurveHandles',
  'connectorLabelPosition'
])

/** What keeping a dragged elbow's new route as its control points changes on the connector. */
const CAPTURED_FIELDS = ['x', 'y', 'connectorControlPoints'] as const

type Captured = Pick<SceneNode, (typeof CAPTURED_FIELDS)[number]>

/** Fields of a connector's sublayers that change its route: the line's weight, the label's size. */
const SUBLAYER_FIELDS: ReadonlySet<string> = new Set<string>([
  ...SIZE_FIELDS,
  'text',
  'strokes',
  'strokeWeight'
])

/**
 * The ends a connector moved as a whole carries along: its free ends stay where its line now
 * draws them, as a pasted or dragged connector's do in FigJam. Ends on layers follow their
 * layers. Null when nothing moves.
 */
function carriedFreeEnds(graph: SceneGraph, connector: SceneNode): Partial<SceneNode> | null {
  const drawn = connectorRouteEnds(graph, connector)
  if (!drawn) return null
  const carried = (endpoint: ConnectorEndpoint | null, at: Vector) =>
    endpoint?.nodeId === null ? freeEndpoint(at.x, at.y) : endpoint
  const changes = {
    connectorStart: carried(connector.connectorStart, drawn.start),
    connectorEnd: carried(connector.connectorEnd, drawn.end)
  }
  return isEqual(changes, pick(connector, ['connectorStart', 'connectorEnd'])) ? null : changes
}

/**
 * Keeps connectors routed as the layers they attach to move, resize, or change, as FigJam does:
 * while a drag previews, and when an edit, undo, or redo lands. A route derives from the layers,
 * so it is laid out again rather than recorded; loading a document keeps the routes it saved,
 * though a label its fonts resize moves its plate, and routes a connector it saved without one
 * once the page it is on is shown.
 */
export function createConnectorRouting(ctx: EditorContext) {
  /**
   * Layers changed since the last pass, whether any change was more than a preview, and whether
   * undo or redo made any.
   */
  let pending: { ids: Set<string>; committed: boolean; replayed: boolean } | null = null
  /** The step an edit just recorded, which the pass that follows the edit may join. */
  let freshStep: UndoEntry | null = null
  let routing = false
  /**
   * The ends of connectors moved since the last undo step, as they were before the move. A move
   * records its step after it lands, as a drag or a run of nudges does, so the next step takes
   * them along.
   */
  const unrecorded = new Map<string, Pick<SceneNode, 'connectorStart' | 'connectorEnd'>>()
  /** Steps already seen at the top of the history, to tell a new step from undo and redo. */
  const seenSteps = new WeakSet<UndoEntry>()

  function schedule(id: string, committed: boolean) {
    if (routing || ctx.graph.isApplyingImportedState) return
    if (!pending) {
      pending = { ids: new Set(), committed: false, replayed: false }
      queueMicrotask(flush)
    }
    pending.ids.add(id)
    pending.committed ||= committed
    pending.replayed ||= ctx.undo.isReplaying
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
      carryFreeEnds(node, committed)
      schedule(id, committed)
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

  /**
   * Carries a connector's free ends as it moves, by as much as its line moved, before the line is
   * laid out again. Undo and redo put the ends back with the step that recorded them instead.
   */
  function carryFreeEnds(connector: SceneNode, committed: boolean) {
    const graph = ctx.graph
    if (
      routing ||
      ctx.undo.isReplaying ||
      graph.isApplyingImportedState ||
      graph.isApplyingLayout
    ) {
      return
    }
    const carried = carriedFreeEnds(graph, connector)
    if (!carried) return
    if (!unrecorded.has(connector.id)) {
      unrecorded.set(
        connector.id,
        structuredClone(pick(connector, ['connectorStart', 'connectorEnd']))
      )
    }
    routing = true
    try {
      if (committed) graph.withLayoutMutations(() => graph.updateNode(connector.id, carried))
      else graph.updateNodePreview(connector.id, carried)
    } finally {
      routing = false
    }
    schedule(connector.id, committed)
  }

  /** Adds the ends connectors were carried from and to into the step just recorded. */
  function recordCarriedEnds() {
    const step = ctx.undo.peekUndo()
    const fresh = step !== undefined && !seenSteps.has(step)
    if (step) seenSteps.add(step)
    if (step && fresh) {
      freshStep = step
      // The pass an edit schedules runs in a microtask queued while the edit runs, before or
      // after it records its step, so both come before this one's inner microtask.
      queueMicrotask(() =>
        queueMicrotask(() => {
          if (freshStep === step) freshStep = null
        })
      )
    }
    const graph = ctx.graph
    const moves = fresh
      ? [...unrecorded].flatMap(([id, before]) => {
          const node = graph.getNode(id)
          if (!node) return []
          const after = structuredClone(pick(node, ['connectorStart', 'connectorEnd']))
          return isEqual(before, after) ? [] : [{ id, before, after }]
        })
      : []
    unrecorded.clear()
    if (moves.length === 0) return
    const apply = (ends: 'before' | 'after') => {
      for (const move of moves) graph.updateNode(move.id, structuredClone(move[ends]))
    }
    ctx.undo.extendLastStep({
      label: 'Move connector',
      forward: () => apply('after'),
      inverse: () => apply('before')
    })
  }

  /**
   * Whether the pass follows an edit that recorded a new undo step, which a dragged elbow's route
   * joins as its new control points, as FigJam keeps them after an edit. Undo, redo, previews,
   * and changes that record no step leave the control points as they are.
   */
  function capturesEdit(batch: NonNullable<typeof pending>): boolean {
    if (!batch.committed || batch.replayed || ctx.undo.isReplaying) return false
    return ctx.undo.isBatching || (freshStep !== null && ctx.undo.peekUndo() === freshStep)
  }

  /** Records the control points edits gave dragged elbows into the step that made the edits. */
  function recordCaptured(captured: { id: string; before: Captured; after: Captured }[]) {
    if (captured.length === 0) return
    const apply = (state: 'before' | 'after') => {
      for (const change of captured) ctx.graph.updateNode(change.id, structuredClone(change[state]))
    }
    ctx.undo.extendLastStep({
      label: 'Route connector',
      forward: () => apply('after'),
      inverse: () => apply('before')
    })
  }

  function flush() {
    const batch = pending
    pending = null
    if (!batch) return
    const graph = ctx.graph
    const affected = connectorsAffectedBy(graph, batch.ids)
    if (affected.length === 0) return
    const capture = capturesEdit(batch)
    const captured: { id: string; before: Captured; after: Captured }[] = []
    routing = true
    try {
      const update = batch.committed
        ? (id: string, changes: Partial<SceneNode>) =>
            graph.withLayoutMutations(() => graph.updateNode(id, changes))
        : (id: string, changes: Partial<SceneNode>) => graph.updateNodePreview(id, changes)
      // A preview keeps each connector's own box, so a drag that places it from where it started
      // carries its free ends by the drag alone; the edit that lands fits the box again.
      const keepBox = !batch.committed
      let moved = false
      for (const connector of affected) {
        const before = structuredClone(pick(connector, CAPTURED_FIELDS))
        moved = layoutConnector(graph, connector, update, { keepBox, capture }) || moved
        if (!capture || connector.connectorControlPoints.length === 0) continue
        const after = structuredClone(pick(connector, CAPTURED_FIELDS))
        if (!isEqual(before.connectorControlPoints, after.connectorControlPoints)) {
          captured.push({ id: connector.id, before, after })
        }
      }
      if (moved) ctx.requestRender()
    } finally {
      routing = false
    }
    recordCaptured(captured)
  }

  // A document read without layout, as a `.fig` is, routes such connectors when shown.
  function routeShownPage(graph: SceneGraph, pageId: string) {
    graph.applyDerivedLayoutDuring(() =>
      graph.withLayoutMutations(() => routeUnroutedConnectors(graph, pageId))
    )
  }

  ctx.onEditorEvent('history:changed', recordCarriedEnds)
  ctx.onEditorEvent('graph:replaced', (graph) => {
    unrecorded.clear()
    routeShownPage(graph, ctx.state.currentPageId)
  })
  ctx.onEditorEvent('page:changed', (pageId) => routeShownPage(ctx.graph, pageId))
  ctx.onEditorEvent('node:updated', (id, changes) => changed(id, changes, true))
  ctx.onEditorEvent('node:previewUpdated', (id, changes) => changed(id, changes, false))
  ctx.onEditorEvent('node:reparented', (id) => schedule(id, true))
  // Moving a layer into another parent by reordering moves it as reparenting does.
  ctx.onEditorEvent('node:reordered', (id, parentId, _index, previousParentId) => {
    if (parentId !== previousParentId) schedule(id, true)
  })
}
