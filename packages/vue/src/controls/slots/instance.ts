import {
  instanceSlotFrames,
  isPreferredComponent,
  nonPreferredLayers,
  ownsSlotContent,
  slotPropertyId
} from '@open-pencil/scene-graph'
import type { ComponentPropertyDefinition, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

/** One configured limit of a slot and whether the instance's content meets it. */
export type SlotLimit =
  | { kind: 'minimum'; count: number; met: boolean }
  | { kind: 'maximum'; count: number; met: boolean }
  | { kind: 'preferred'; met: boolean; offending: number }

/** A component the Add instances list can insert into a slot. */
export interface SlotInstanceOption {
  id: string
  name: string
  preferred: boolean
  /** The page or library the component comes from. */
  source: string
}

export interface SlotPropertyControl {
  id: string
  name: string
  /** The instance's frame that holds this slot's content. */
  frameId: string
  /** Whether the instance owns the content instead of following its component. */
  modified: boolean
  itemCount: number
  limits: SlotLimit[]
  preferredOnly: boolean
  /** Content layers that break the preferred-only limit. */
  offendingIds: string[]
}

/** A slot's limits, measured against the content the instance shows. */
export function slotLimits(
  graph: SceneGraph,
  definition: ComponentPropertyDefinition,
  content: readonly SceneNode[]
): { limits: SlotLimit[]; offendingIds: string[] } {
  const settings = definition.slotSettings
  const limits: SlotLimit[] = []
  let offendingIds: string[] = []
  if (!settings) return { limits, offendingIds }
  if (settings.minChildren !== undefined)
    limits.push({
      kind: 'minimum',
      count: settings.minChildren,
      met: content.length >= settings.minChildren
    })
  if (settings.maxChildren !== undefined)
    limits.push({
      kind: 'maximum',
      count: settings.maxChildren,
      met: content.length <= settings.maxChildren
    })
  if (settings.allowPreferredValuesOnly) {
    offendingIds = nonPreferredLayers(graph, definition, content).map((node) => node.id)
    limits.push({
      kind: 'preferred',
      met: offendingIds.length === 0,
      offending: offendingIds.length
    })
  }
  return { limits, offendingIds }
}

function pageName(graph: SceneGraph, node: SceneNode): string {
  let current: SceneNode | undefined = node
  while (current && current.type !== 'CANVAS')
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  return current?.name ?? ''
}

/** Components a slot can take, its preferred ones first. */
export function slotInstanceOptions(
  graph: SceneGraph,
  definition: ComponentPropertyDefinition
): SlotInstanceOption[] {
  return [...graph.getAllNodes()]
    .filter((node) => node.type === 'COMPONENT')
    .map((node) => ({
      id: node.id,
      name: node.name,
      preferred: isPreferredComponent(node, definition.preferredValues),
      source: pageName(graph, node)
    }))
    .sort(
      (left, right) =>
        Number(right.preferred) - Number(left.preferred) || left.name.localeCompare(right.name)
    )
}

/** Slot properties of the single selected instance, and the actions on their content. */
export function useSlotProperties() {
  const editor = useEditor()
  const instance = useSceneComputed(() => {
    const nodes = editor.getSelectedNodes()
    return nodes.length === 1 && nodes[0].type === 'INSTANCE' ? nodes[0] : undefined
  })
  const definitions = useSceneComputed(() =>
    instance.value
      ? editor
          .getInstanceComponentPropertyDefinitions(instance.value.id)
          .filter((definition) => definition.type === 'SLOT')
      : []
  )
  const slots = useSceneComputed<SlotPropertyControl[]>(() => {
    const owner = instance.value
    if (!owner) return []
    const frames = instanceSlotFrames(editor.graph, owner)
    return definitions.value.flatMap((definition) => {
      const frame = frames.find((candidate) => slotPropertyId(candidate) === definition.id)
      if (!frame) return []
      const content = editor.graph.getChildren(frame.id)
      const { limits, offendingIds } = slotLimits(editor.graph, definition, content)
      return [
        {
          id: definition.id,
          name: definition.name,
          frameId: frame.id,
          modified: ownsSlotContent(editor.graph, frame, definition.id),
          itemCount: content.length,
          limits,
          preferredOnly: definition.slotSettings?.allowPreferredValuesOnly ?? false,
          offendingIds
        }
      ]
    })
  })

  function options(propertyId: string): SlotInstanceOption[] {
    const definition = definitions.value.find((item) => item.id === propertyId)
    return definition ? slotInstanceOptions(editor.graph, definition) : []
  }

  return {
    slots,
    options,
    add: (frameId: string, componentId: string) => editor.addInstanceToSlot(frameId, componentId),
    reset: (frameId: string) => editor.resetSlot(frameId),
    clear: (frameId: string) => editor.clearSlot(frameId),
    selectLayers: (ids: string[]) => editor.select(ids)
  }
}
