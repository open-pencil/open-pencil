import type { SceneGraph } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'
import {
  cachedStatusWorkflow,
  figmaDevStatusOf,
  shownStatusState,
  statusPlacement,
  type FigmaDevStatus,
  type StatusPlacement
} from '@open-pencil/scene-graph/statuses'

import { nodeOf, type NodeRef } from './behaviours'

/** One of the document's statuses as scripts see it. */
export interface StatusInfo {
  name: string
  /** `#RRGGBB`. */
  color: string
  /** The status Figma shows for it, if it has one. */
  figma: FigmaDevStatus | null
}

/** The document's statuses, in the order menus list them. */
export function listStatuses(graph: SceneGraph): StatusInfo[] {
  return cachedStatusWorkflow(graph).states.map((state) => ({
    name: state.name,
    color: colorToHex(state.color),
    figma: figmaDevStatusOf(state.id)
  }))
}

/** The name of the status a layer shows, or null; a status its place hides reads as null. */
export function getStatus(graph: SceneGraph, ref: NodeRef): string | null {
  return shownStatusState(graph, nodeOf(graph, ref))?.name ?? null
}

/** Why a layer cannot take a status where it is, after its name. */
const PLACEMENT_ERRORS = {
  type: 'only sections, frames, components, component sets and instances can',
  parent: 'it is not directly on a page or in a section',
  ancestor: 'a section around it has one'
} as const satisfies Record<Exclude<StatusPlacement, 'ok'>, string>

/** Give a layer the status named `name`, or clear its status with null. */
export function setStatus(graph: SceneGraph, ref: NodeRef, name: string | null): void {
  const node = nodeOf(graph, ref)
  if (name === null) {
    graph.updateNode(node.id, { status: null })
    return
  }
  const { states } = cachedStatusWorkflow(graph)
  const state = states.find((entry) => entry.name === name)
  if (!state) {
    const names = states.map((entry) => entry.name).join(', ')
    throw new Error(`No status named ${name}; the document has ${names}`)
  }
  const placement = statusPlacement(graph, node)
  if (placement !== 'ok') {
    throw new Error(`${node.name} cannot have a status: ${PLACEMENT_ERRORS[placement]}`)
  }
  graph.updateNode(node.id, { status: state.id })
}
