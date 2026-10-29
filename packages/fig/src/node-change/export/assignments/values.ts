import type { SceneNode } from '@open-pencil/scene-graph'

import {
  getOrCreateNodeGuid,
  getOrCreatePropertyGuid,
  parseGuidOrNull,
  type SceneNodeToKiwiContext
} from '../context'
import { slotContentAssignment } from '../slots'

export function componentPropertyValue(
  type: string,
  value: string,
  context: SceneNodeToKiwiContext,
  localIdCounter: { value: number }
) {
  if (type === 'BOOLEAN') return { boolValue: value === 'true' }
  if (type === 'INSTANCE_SWAP') {
    const target = context.graph.getNode(value)
    const guid = target
      ? getOrCreateNodeGuid(context, target.id, localIdCounter)
      : parseGuidOrNull(value)
    return guid ? { guidValue: guid } : { textValue: { characters: value } }
  }
  return { textValue: { characters: value } }
}

export function componentPropertyVariableValue(
  type: string,
  value: string,
  context: SceneNodeToKiwiContext,
  localIdCounter: { value: number }
) {
  const legacy = componentPropertyValue(type, value, context, localIdCounter)
  if (type === 'BOOLEAN')
    return {
      value: { boolValue: value === 'true' },
      dataType: 'BOOLEAN',
      resolvedDataType: 'BOOLEAN'
    }
  if (type === 'INSTANCE_SWAP' && 'guidValue' in legacy) {
    return {
      value: { symbolIdValue: { guid: legacy.guidValue } },
      dataType: 'SYMBOL_ID',
      resolvedDataType: 'SYMBOL_ID'
    }
  }
  return { value: { textValue: value }, dataType: 'STRING', resolvedDataType: 'STRING' }
}

/**
 * An instance's value for one component property, as `componentPropAssignments` holds it: on
 * the instance's own record, or on the override at a nested instance's path. `null` for a
 * property the export knows no definition of.
 */
export function componentPropAssignment(
  context: SceneNodeToKiwiContext,
  instance: SceneNode,
  propertyId: string,
  value: string,
  localIdCounter: { value: number }
) {
  const definition = context.componentPropertyDefinitionsById.get(propertyId)
  if (!definition) return null
  const defID = getOrCreatePropertyGuid(context, propertyId, localIdCounter)
  if (definition.type === 'SLOT')
    return slotContentAssignment(context, instance, propertyId, defID, localIdCounter)
  return {
    defID,
    value: componentPropertyValue(definition.type, value, context, localIdCounter),
    varValue: componentPropertyVariableValue(definition.type, value, context, localIdCounter)
  }
}
