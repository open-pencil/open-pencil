import type { GUID, NodeChange, VariableDataEntry } from '@open-pencil/kiwi/fig/codec'
import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
import type { SceneGraph, VariableValue } from '@open-pencil/scene-graph'

import { fractionalPosition, safeColor } from '#core/kiwi/fig/node-change/serialize'

function variableValueToKiwi(
  value: VariableValue,
  type: string,
  ids: Map<string, GUID>
): VariableDataEntry {
  if (typeof value === 'object' && 'aliasId' in value)
    return {
      value: { alias: { guid: ids.get(value.aliasId) ?? stringToGuid(value.aliasId) } },
      dataType: 'ALIAS',
      resolvedDataType: type
    }
  if (type === 'COLOR' && typeof value === 'object' && 'r' in value)
    return { value: { colorValue: safeColor(value) }, dataType: type, resolvedDataType: type }
  if (type === 'BOOLEAN')
    return { value: { boolValue: !!value }, dataType: type, resolvedDataType: type }
  if (type === 'STRING')
    return {
      value: { textValue: typeof value === 'string' ? value : JSON.stringify(value) },
      dataType: type,
      resolvedDataType: type
    }
  return { value: { floatValue: Number(value) }, dataType: 'FLOAT', resolvedDataType: 'FLOAT' }
}

export function appendVariableNodeChanges(
  graph: SceneGraph,
  changes: NodeChange[],
  parent: GUID,
  ids: Map<string, GUID>,
  modes: Map<string, GUID>
): void {
  let index = 0
  for (const collection of graph.variableCollections.values()) {
    const guid = ids.get(collection.id) ?? stringToGuid(collection.id)
    changes.push({
      guid,
      parentIndex: { guid: parent, position: fractionalPosition(index++) },
      type: 'VARIABLE_SET',
      name: collection.name,
      phase: 'CREATED',
      strokeAlign: 'CENTER',
      strokeJoin: 'BEVEL',
      variableSetModes: collection.modes.map((mode, i) => ({
        id: modes.get(mode.modeId) ?? stringToGuid(mode.modeId),
        name: mode.name,
        sortPosition: fractionalPosition(i)
      }))
    })
    let variableIndex = 0
    for (const id of collection.variableIds) {
      const variable = graph.variables.get(id)
      if (!variable) continue
      changes.push({
        guid: ids.get(id) ?? stringToGuid(id),
        parentIndex: { guid: parent, position: fractionalPosition(variableIndex++) },
        type: 'VARIABLE',
        name: variable.name,
        phase: 'CREATED',
        strokeAlign: 'CENTER',
        strokeJoin: 'BEVEL',
        variableSetID: { guid },
        variableResolvedType: variable.type,
        variableDataValues: {
          entries: Object.entries(variable.valuesByMode).map(([mode, value]) => ({
            modeID: modes.get(mode) ?? stringToGuid(mode),
            variableData: variableValueToKiwi(value, variable.type, ids)
          }))
        },
        variableScopes: ['ALL_SCOPES'],
        key: variable.key,
        version: variable.version
      })
    }
  }
}
