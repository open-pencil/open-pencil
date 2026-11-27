import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { SceneNode } from '@open-pencil/scene-graph'

import { assignmentValue } from './bindings/properties'
import type { InstanceOccurrence } from './occurrence/types'
import { assignedSlotContent, forEachOverrideRecord, type ComponentPropAssignment } from './types'

/** The slot content frames a record assigns: its own and its overrides', at every depth. */
export function slotContentAssignedBy(record: NodeChange): string[] {
  const ids: string[] = []
  forEachOverrideRecord(record, (source) => {
    const assignments = (source.componentPropAssignments ?? []) as ComponentPropAssignment[]
    for (const assignment of assignments) {
      const content = assignedSlotContent(assignmentValue(assignment))
      if (content) ids.push(guidToString(content))
    }
  })
  return ids
}

export interface SlotContentLayers {
  /**
   * The records slot content comes from, each with the layer built for it: the content frame
   * Figma keeps on the internal canvas, under the slot frame showing it, and the layers inside,
   * which are records of their own down to any instance in them.
   */
  records: Array<[record: string, layer: string]>
  /** Instances' saved slot assignments whose content no layer of theirs shows, by instance. */
  hidden: Array<[layer: string, assignments: ComponentPropAssignment[]]>
}

/** Every slot content ID shown under an occurrence. */
function shownSlotContent(occurrence: InstanceOccurrence, shown = new Set<string>()): Set<string> {
  for (const child of occurrence.children) {
    if (child.slotContentId !== undefined) shown.add(child.slotContentId)
    shownSlotContent(child, shown)
  }
  return shown
}

/**
 * What a save needs to write an instance's slot content back under the GUIDs the file gave it,
 * for the records of its own under `root`: their slot content, and the slot assignments no
 * layer shows, which the graph does not hold otherwise.
 */
export function slotContentLayers(
  root: InstanceOccurrence,
  nodes: ReadonlyMap<InstanceOccurrence, SceneNode>
): SlotContentLayers {
  const layers: SlotContentLayers = { records: [], hidden: [] }
  const record = (id: string, occurrence: InstanceOccurrence) => {
    const node = nodes.get(occurrence)
    if (node) layers.records.push([id, node.id])
  }
  const hide = (instance: InstanceOccurrence) => {
    const node = nodes.get(instance)
    const saved = (instance.properties.componentPropAssignments ?? []) as ComponentPropAssignment[]
    const shown = shownSlotContent(instance)
    const hidden = saved.filter((assignment) => {
      const content = assignedSlotContent(assignment.varValue?.value)
      return content !== undefined && !shown.has(guidToString(content))
    })
    if (node && hidden.length > 0) layers.hidden.push([node.id, hidden])
  }
  const slots = (occurrence: InstanceOccurrence): void => {
    for (const child of occurrence.children) {
      if (child.slotContentId === undefined) {
        slots(child)
        continue
      }
      record(child.slotContentId, child)
      for (const content of child.children) own(content, true)
    }
  }
  /** A record of its own; one in slot content is listed with the layer built for it. */
  const own = (occurrence: InstanceOccurrence, inContent: boolean): void => {
    if (inContent) record(occurrence.sourceId, occurrence)
    if (occurrence.mainComponentId === null) {
      for (const child of occurrence.children) own(child, inContent)
      return
    }
    hide(occurrence)
    slots(occurrence)
  }
  own(root, false)
  return layers
}
