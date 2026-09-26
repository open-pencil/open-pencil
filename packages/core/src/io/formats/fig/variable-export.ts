import type { GUID, NodeChange, VariableDataEntry } from '@open-pencil/kiwi/fig/codec'
import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
import type { SceneGraph, SceneNode, VariableValue } from '@open-pencil/scene-graph'

import { fractionalPosition, safeColor } from '#core/kiwi/fig/node-change/serialize'

/**
 * Identity allocation shared by the two writers. The document exporter and the clipboard
 * both emit variables, modes and shared styles ahead of the nodes that reference them; when
 * each allocated its own way the two drifted.
 */
export function assignVariableGuid(
  id: string,
  localIdCounter: { value: number },
  assignedGuidValues: Set<string>,
  nodeSourceGuidValues: Set<string>
): GUID {
  if (/^\d+:\d+$/.test(id) && !assignedGuidValues.has(id) && !nodeSourceGuidValues.has(id)) {
    const guid = stringToGuid(id)
    assignedGuidValues.add(id)
    return guid
  }
  const guid = { sessionID: 0, localID: localIdCounter.value++ }
  assignedGuidValues.add(`${guid.sessionID}:${guid.localID}`)
  return guid
}

export function assignVariableGuids(
  graph: SceneGraph,
  localIdCounter: { value: number },
  varIdToGuid: Map<string, GUID>,
  modeIdToGuid: Map<string, GUID>,
  assignedGuidValues: Set<string>,
  nodeSourceGuidValues: Set<string>
): void {
  for (const [colId, col] of graph.variableCollections) {
    const colGuid = assignVariableGuid(
      colId,
      localIdCounter,
      assignedGuidValues,
      nodeSourceGuidValues
    )
    varIdToGuid.set(colId, colGuid)
    for (const mode of col.modes) {
      const modeGuid = assignVariableGuid(
        mode.modeId,
        localIdCounter,
        assignedGuidValues,
        nodeSourceGuidValues
      )
      modeIdToGuid.set(mode.modeId, modeGuid)
    }
    for (const varId of col.variableIds) {
      const varGuid = assignVariableGuid(
        varId,
        localIdCounter,
        assignedGuidValues,
        nodeSourceGuidValues
      )
      varIdToGuid.set(varId, varGuid)
    }
  }
}

/** Shared styles live on the internal canvas and need a GUID before any node cites them. */
export function assignSharedStyleGuids(
  styles: readonly SceneNode[],
  localIdCounter: { value: number },
  nodeIdToGuid: Map<string, GUID>,
  assignedGuidValues: Set<string>
): void {
  for (const style of styles) {
    if (nodeIdToGuid.has(style.id)) continue
    let guid: GUID
    do {
      guid = { sessionID: 1, localID: localIdCounter.value++ }
    } while (assignedGuidValues.has(`${guid.sessionID}:${guid.localID}`))
    nodeIdToGuid.set(style.id, guid)
    assignedGuidValues.add(`${guid.sessionID}:${guid.localID}`)
  }
}


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
