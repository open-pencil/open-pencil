import { isEqual } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { GUID } from '@open-pencil/scene-graph/primitives'

import type { KiwiSymbolOverridePayload } from './context'

/** The name Figma shows for an instance without one of its own: its variant set's or its component's. */
function defaultInstanceName(graph: SceneGraph, componentId: string): string | undefined {
  const component = graph.getNode(componentId)
  if (!component) return undefined
  const parent = component.parentId ? graph.getNode(component.parentId) : undefined
  return parent?.type === 'COMPONENT_SET' ? parent.name : component.name
}

/**
 * Figma shows an instance's name from the override at its own path and ignores the record's.
 * Writes the instance's name there when it differs from the name Figma would show, or when the
 * file already named it there.
 */
export function writeOwnInstanceName(
  graph: SceneGraph,
  instance: SceneNode,
  ownPath: GUID[],
  symbolOverrides: KiwiSymbolOverridePayload[]
): void {
  if (!instance.componentId) return
  const index = symbolOverrides.findIndex(({ guidPath }) => isEqual(guidPath?.guids, ownPath))
  const named = index !== -1 && 'name' in symbolOverrides[index]
  if (!named && instance.name === defaultInstanceName(graph, instance.componentId)) return
  if (index === -1) symbolOverrides.push({ guidPath: { guids: ownPath }, name: instance.name })
  else symbolOverrides[index] = { ...symbolOverrides[index], name: instance.name }
}
