import { parseColor } from '../color'
import type { SceneGraph } from '../graph'
import { readPluginData, withPluginData } from '../plugin-data/field'
import { OPEN_PENCIL_PLUGIN_DATA } from '../plugin-data/fields'
import type { SceneNode } from '../types'
import { effectiveStatus } from './node'
import type { FigmaDevStatus, StatusState, StatusWorkflow } from './schema'

const { statuses } = OPEN_PENCIL_PLUGIN_DATA

/**
 * The states Figma shows, by fixed id. Teams rename them as they like, but a `.fig` file's
 * Ready for dev and Completed always read back as these, without the document's workflow.
 */
export const FIGMA_STATUS_STATE_IDS = {
  READY_FOR_DEV: 'ready-for-dev',
  COMPLETED: 'completed'
} as const satisfies Record<FigmaDevStatus, string>

const READY_FOR_DEV: StatusState = {
  id: FIGMA_STATUS_STATE_IDS.READY_FOR_DEV,
  name: 'Ready for dev',
  color: parseColor('#14ae5c')
}

const COMPLETED: StatusState = {
  id: FIGMA_STATUS_STATE_IDS.COMPLETED,
  name: 'Completed',
  color: parseColor('#8a8a8a')
}

/**
 * Workflows to start from. Their states keep fixed ids, so a document using a preset, or no
 * workflow of its own, reads the same states back.
 */
export const STATUS_WORKFLOW_PRESETS = {
  handoff: { preset: 'handoff', states: [READY_FOR_DEV, COMPLETED] },
  simple: {
    preset: 'simple',
    states: [
      { id: 'draft', name: 'Draft', color: parseColor('#b3b3b3') },
      { id: 'in-progress', name: 'In progress', color: parseColor('#0d99ff') },
      { ...COMPLETED, name: 'Done', color: parseColor('#14ae5c') }
    ]
  },
  review: {
    preset: 'review',
    states: [
      { id: 'draft', name: 'Draft', color: parseColor('#b3b3b3') },
      { id: 'in-review', name: 'In review', color: parseColor('#9747ff') },
      { id: 'changes-requested', name: 'Changes requested', color: parseColor('#f24822') },
      { id: 'approved', name: 'Approved', color: parseColor('#0d99ff') },
      READY_FOR_DEV,
      { ...COMPLETED, name: 'Shipped' }
    ]
  }
} as const satisfies Record<string, StatusWorkflow>

export type StatusWorkflowPreset = keyof typeof STATUS_WORKFLOW_PRESETS

/**
 * The document's statuses. A document that never chose any has Figma's own, so a `.fig` file's
 * Ready for dev and Completed read as statuses without setup.
 */
export function readStatusWorkflow(graph: SceneGraph): StatusWorkflow {
  return (
    readPluginData(graph.getNode(graph.rootId)?.pluginData, statuses) ??
    STATUS_WORKFLOW_PRESETS.handoff
  )
}

/** Stores the workflow on the document node, as an undoable document change. */
export function writeStatusWorkflow(graph: SceneGraph, workflow: StatusWorkflow): void {
  const root = graph.getNode(graph.rootId)
  if (!root) return
  graph.updateNode(root.id, {
    pluginData: withPluginData(root.pluginData, statuses, structuredClone(workflow))
  })
}

/**
 * The state `stateId` names: the workflow's own, or Figma's when the workflow has no such state,
 * as a `.fig` file's Ready for dev reads in a document whose team removed it.
 */
export function findStatusState(
  workflow: StatusWorkflow,
  stateId: string
): StatusState | undefined {
  return (
    workflow.states.find((state) => state.id === stateId) ??
    STATUS_WORKFLOW_PRESETS.handoff.states.find((state) => state.id === stateId)
  )
}

/** The Figma status a state shows as in Figma and the Plugin API's `devStatus`, if any. */
export function figmaDevStatusOf(stateId: string): FigmaDevStatus | null {
  if (stateId === FIGMA_STATUS_STATE_IDS.READY_FOR_DEV) return 'READY_FOR_DEV'
  if (stateId === FIGMA_STATUS_STATE_IDS.COMPLETED) return 'COMPLETED'
  return null
}

const WORKFLOWS = new WeakMap<SceneGraph, { entries: unknown; workflow: StatusWorkflow }>()

/**
 * The document's statuses, read once per change to the document node: canvas labels ask for
 * them on every frame.
 */
export function cachedStatusWorkflow(graph: SceneGraph): StatusWorkflow {
  const entries = graph.getNode(graph.rootId)?.pluginData
  const known = WORKFLOWS.get(graph)
  if (known && known.entries === entries) return known.workflow
  const workflow = readStatusWorkflow(graph)
  WORKFLOWS.set(graph, { entries, workflow })
  return workflow
}

/** The state a layer shows, if any. */
export function shownStatusState(graph: SceneGraph, node: SceneNode): StatusState | null {
  const id = effectiveStatus(graph, node)
  return id === null ? null : (findStatusState(cachedStatusWorkflow(graph), id) ?? null)
}
