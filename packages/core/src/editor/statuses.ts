import {
  OPEN_PENCIL_PLUGIN_DATA,
  readPluginData,
  withPluginData
} from '@open-pencil/scene-graph/plugin-data'
import {
  cachedStatusWorkflow,
  shownStatusState,
  statusPlacement,
  type StatusState,
  type StatusWorkflow
} from '@open-pencil/scene-graph/statuses'

import type { EditorContext } from './types'

/** Statuses as the canvas and panels show them, and the commands that change them. */
export function createStatusActions(ctx: EditorContext) {
  function statusWorkflow(): StatusWorkflow {
    return cachedStatusWorkflow(ctx.graph)
  }

  /** The state `nodeId` shows, or null when it shows none. */
  function getShownStatus(nodeId: string): StatusState | null {
    const node = ctx.graph.getNode(nodeId)
    return node ? shownStatusState(ctx.graph, node) : null
  }

  /** Puts `statuses` on their layers as one undo step, labelled `label`. */
  function applyStatuses(label: string, statuses: ReadonlyMap<string, string | null>): void {
    const previous = new Map(
      [...statuses.keys()].map((id) => [id, ctx.graph.getNode(id)?.status ?? null])
    )
    const write = (values: ReadonlyMap<string, string | null>) => {
      for (const [id, status] of values) ctx.graph.updateNode(id, { status })
      ctx.requestRender()
    }
    write(statuses)
    ctx.undo.push({ label, forward: () => write(statuses), inverse: () => write(previous) })
  }

  /**
   * Sets `stateId` on the layers of `nodeIds` that can show a status, or clears theirs with null,
   * in one undo step. Returns how many layers changed.
   */
  function setStatus(nodeIds: readonly string[], stateId: string | null): number {
    const statuses = new Map<string, string | null>()
    for (const id of nodeIds) {
      const node = ctx.graph.getNode(id)
      if (!node || node.status === stateId) continue
      if (stateId !== null && statusPlacement(ctx.graph, node) !== 'ok') continue
      if (stateId === null && !node.status) continue
      statuses.set(id, stateId)
    }
    if (statuses.size > 0)
      applyStatuses(stateId === null ? 'Remove status' : 'Set status', statuses)
    return statuses.size
  }

  /**
   * Replaces the document's statuses as one undo step. `moves` sends the layers in a state the
   * new workflow drops to another state, or clears theirs with null. Undo restores only the
   * workflow and those layers, so comments written meanwhile on the document node stay.
   */
  function setStatusWorkflow(
    next: StatusWorkflow,
    moves: Readonly<Record<string, string | null>> = {}
  ): void {
    const { statuses } = OPEN_PENCIL_PLUGIN_DATA
    const rootId = ctx.graph.rootId
    const previous = readPluginData(ctx.graph.getNode(rootId)?.pluginData, statuses)
    const write = (value: StatusWorkflow | undefined) => {
      const root = ctx.graph.getNode(rootId)
      if (!root) return
      ctx.graph.updateNode(rootId, {
        pluginData: withPluginData(root.pluginData, statuses, value && structuredClone(value))
      })
      ctx.requestRender()
    }
    const moved = new Map<string, string | null>()
    for (const node of ctx.graph.getAllNodes()) {
      const target = node.status ? moves[node.status] : undefined
      if (target !== undefined) moved.set(node.id, target)
    }
    ctx.undo.runBatch('Edit statuses', () => {
      write(next)
      ctx.undo.push({
        label: 'Edit statuses',
        forward: () => write(next),
        inverse: () => write(previous)
      })
      if (moved.size > 0) applyStatuses('Edit statuses', moved)
    })
  }

  return {
    statusWorkflow,
    getShownStatus,
    setStatus,
    setStatusWorkflow
  }
}
