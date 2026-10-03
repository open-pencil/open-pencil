import { DEFAULT_SLOT_CONTENT } from '#fig/instance-overrides/types'

import {
  ownsSlotContent,
  slotPropertyId,
  type ComponentPropertyDefinition,
  type SceneNode
} from '@open-pencil/scene-graph'
import type { GUID } from '@open-pencil/scene-graph/primitives'

import type { KiwiNodeChange, SceneNodeToKiwiContext } from './context'

function slotContentValue(guid: GUID) {
  return {
    value: { slotContentIdValue: { guid } },
    dataType: 'SLOT_CONTENT_ID',
    resolvedDataType: 'SLOT_CONTENT_ID'
  }
}

/** Slot-specific fields of a `SLOT` property definition record. */
export function slotDefinitionFields(
  definition: ComponentPropertyDefinition
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    varValue: slotContentValue({ ...DEFAULT_SLOT_CONTENT })
  }
  const settings = definition.slotSettings
  if (!settings) return fields
  const config: Record<string, unknown> = {
    stretchChildOnInsert: settings.stretchChildOnInsert,
    displayByDefault: settings.displayEmptyByDefault,
    allowPreferredValuesOnly: settings.allowPreferredValuesOnly
  }
  if (settings.minChildren !== undefined) config.minChildren = settings.minChildren
  if (settings.maxChildren !== undefined) config.maxChildren = settings.maxChildren
  fields.slotPropConfig = config
  return fields
}

/** The frame in this instance whose children are its content for a slot property. */
function ownedSlotFrame(
  context: SceneNodeToKiwiContext,
  instance: SceneNode,
  propertyId: string
): SceneNode | undefined {
  const visit = (node: SceneNode): SceneNode | undefined => {
    for (const child of context.graph.getChildren(node.id)) {
      if (slotPropertyId(child) === propertyId && ownsSlotContent(context.graph, child))
        return child
      // A nested instance's slots are assigned by that instance, not this one.
      if (child.type === 'INSTANCE') continue
      const found = visit(child)
      if (found) return found
    }
    return undefined
  }
  return visit(instance)
}

/**
 * Figma keeps an instance's slot content as a frame on the internal canvas, marked as slot
 * content, and assigns the slot property that frame's GUID. Its records go to
 * `context.slotContentRecords`, which the caller parents under its internal canvas; without
 * that sink the assignment is not written and the instance shows the component's content.
 */
export function slotContentAssignment(
  context: SceneNodeToKiwiContext,
  instance: SceneNode,
  propertyId: string,
  defID: GUID,
  localIdCounter: { value: number }
) {
  const sink = context.slotContentRecords
  const frame = ownedSlotFrame(context, instance, propertyId)
  if (!sink || !frame) return null
  const records = context.sceneNodeToKiwi(
    frame,
    { ...DEFAULT_SLOT_CONTENT },
    0,
    localIdCounter,
    context
  )
  const root = records.at(0)
  if (!root?.guid) return null
  markSlotContent(root)
  sink.push(...records)
  return { defID, varValue: slotContentValue(root.guid) }
}

/** A content frame holds the content; the binding that made its source a slot stays behind. */
function markSlotContent(record: KiwiNodeChange): void {
  record.isSlotContent = true
  Reflect.deleteProperty(record, 'componentPropRefs')
  const parameters = record.parameterConsumptionMap as
    | { entries?: Array<{ variableField?: string }> }
    | undefined
  const entries = parameters?.entries?.filter((entry) => entry.variableField !== 'SLOT_CONTENT_ID')
  if (entries?.length) record.parameterConsumptionMap = { entries }
  else Reflect.deleteProperty(record, 'parameterConsumptionMap')
}

/**
 * Parent the slot content frames among `records` under `canvas` (the internal canvas, or a
 * clipboard's dependency canvas), numbering from `firstIndex` after what is already there.
 */
export function placeSlotContent(
  records: readonly KiwiNodeChange[],
  canvas: GUID,
  firstIndex: number,
  position: (index: number) => string
): void {
  let index = firstIndex
  for (const record of records)
    if (record.isSlotContent === true)
      record.parentIndex = { guid: canvas, position: position(index++) }
}
