import * as v from 'valibot'

import {
  collectionPluginDataNodeChange,
  figmaFormulaFunction,
  parseGuidOrNull,
  mapUnsupportedExpressionReferences,
  unsupportedExpressionData,
  variableAlias,
  variableMetadataNodeChange,
  safeColor
} from '@open-pencil/fig/node-change'
import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange, VariableDataEntry } from '@open-pencil/kiwi/fig/codec'
import { guidToString, stringToGuid } from '@open-pencil/kiwi/fig/guid'
import type {
  SceneGraph,
  SceneNode,
  VariableFormulaNode,
  VariableCollectionMode,
  VariableValue
} from '@open-pencil/scene-graph'
import { fractionalPosition, orderKeyBetween } from '@open-pencil/scene-graph/order-keys'
import {
  modesDefaultFirst,
  isUnsupportedVariableValue,
  foldFormula,
  formulaValueType,
  inferFormulaType,
  variableFormulaSchema,
  variableColorExpressionSchema
} from '@open-pencil/scene-graph/variables'

/**
 * Identity allocation shared by the two writers. The document exporter and the clipboard
 * both emit variables, modes and shared styles ahead of the nodes that reference them; when
 * each allocated its own way the two drifted.
 */
export function assignVariableGuid(
  id: string,
  localIdCounter: { value: number },
  assignedGuidValues: Set<string>,
  nodeSourceGuidValues: Set<string>,
  keepsGuid: (id: string) => boolean = () => true
): GUID {
  const own = keepsGuid(id) ? parseGuidOrNull(id) : null
  if (own && !assignedGuidValues.has(id) && !nodeSourceGuidValues.has(id)) {
    assignedGuidValues.add(id)
    return own
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
  nodeSourceGuidValues: Set<string>,
  keepsGuid?: (id: string) => boolean
): void {
  for (const [colId, col] of graph.variableCollections) {
    const colGuid = assignVariableGuid(
      colId,
      localIdCounter,
      assignedGuidValues,
      nodeSourceGuidValues,
      keepsGuid
    )
    varIdToGuid.set(colId, colGuid)
    for (const mode of col.modes) {
      const modeGuid = assignVariableGuid(
        mode.modeId,
        localIdCounter,
        assignedGuidValues,
        nodeSourceGuidValues,
        keepsGuid
      )
      modeIdToGuid.set(mode.modeId, modeGuid)
    }
    for (const varId of col.variableIds) {
      const varGuid = assignVariableGuid(
        varId,
        localIdCounter,
        assignedGuidValues,
        nodeSourceGuidValues,
        keepsGuid
      )
      varIdToGuid.set(varId, varGuid)
    }
  }
}

/**
 * Where Figma lists each mode: where the file saved it, and a new mode after the rest. A
 * collection made in OpenPencil lists its modes in their order.
 */
function modeSortPositions(modes: readonly VariableCollectionMode[]) {
  if (modes.every((mode) => !mode.sortPosition))
    return modes.map((mode, index) => ({ mode, sortPosition: fractionalPosition(index) }))
  let last = modes.reduce<string | null>(
    (highest, mode) =>
      mode.sortPosition && (!highest || mode.sortPosition > highest) ? mode.sortPosition : highest,
    null
  )
  return modes.map((mode) => {
    if (mode.sortPosition) return { mode, sortPosition: mode.sortPosition }
    last = orderKeyBetween(last, null)
    return { mode, sortPosition: last }
  })
}

/**
 * Shared styles live on the internal canvas and need a GUID before any node cites them. A style
 * read from Figma keeps the GUID it came with, which its ID spells; the others take new ones.
 */
export function assignSharedStyleGuids(
  styles: readonly SceneNode[],
  localIdCounter: { value: number },
  nodeIdToGuid: Map<string, GUID>,
  assignedGuidValues: Set<string>
): void {
  for (const style of styles) {
    if (nodeIdToGuid.has(style.id)) continue
    // A style read from Figma keeps its GUID, compared in the form the ID parses to.
    const imported = style.source.id ? parseGuidOrNull(style.source.id) : null
    const value = imported ? guidToString(imported) : null
    if (imported && value && !assignedGuidValues.has(value)) {
      nodeIdToGuid.set(style.id, imported)
      assignedGuidValues.add(value)
      continue
    }
    let guid: GUID
    do {
      guid = { sessionID: 1, localID: localIdCounter.value++ }
    } while (assignedGuidValues.has(`${guid.sessionID}:${guid.localID}`))
    nodeIdToGuid.set(style.id, guid)
    assignedGuidValues.add(`${guid.sessionID}:${guid.localID}`)
  }
}

function variableValueToKiwi(
  graph: SceneGraph,
  value: VariableValue,
  type: string,
  ids: Map<string, GUID>,
  modes?: ReadonlyMap<string, GUID>
): VariableDataEntry {
  if (isUnsupportedVariableValue(value)) {
    const data = unsupportedExpressionData(value.value)
    mapUnsupportedExpressionReferences(
      data,
      (_, index) => {
        const id = value.references[index]
        return id && graph.variables.has(id) ? variableAlias(graph, id, ids) : undefined
      },
      (guid, index) => modes?.get(value.modes[index] ?? '') ?? guid
    )
    return data
  }
  if (typeof value === 'object' && 'expression' in value && value.expression === 'FORMULA') {
    const formula = v.parse(variableFormulaSchema, value)
    if (formula.type !== type) throw new Error('Formula type does not match variable type')
    return formulaToKiwi(graph, formula.value, ids)
  }
  if (typeof value === 'object' && 'expression' in value) {
    const expression = v.parse(variableColorExpressionSchema, value)
    if (type !== 'COLOR') throw new Error('Color expression requires a color variable')
    return {
      dataType: 'EXPRESSION',
      resolvedDataType: 'COLOR',
      value: {
        expressionValue: {
          expressionFunction: expression.expression,
          expressionArguments: [
            variableValueToKiwi(graph, expression.color, 'COLOR', ids),
            variableValueToKiwi(graph, expression.opacity, 'FLOAT', ids)
          ]
        }
      }
    }
  }
  if (typeof value === 'object' && 'aliasId' in value)
    return {
      value: { alias: variableAlias(graph, value.aliasId, ids) },
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

function formulaToKiwi(
  graph: SceneGraph,
  node: VariableFormulaNode,
  ids: Map<string, GUID>
): VariableDataEntry {
  const typeOf = (id: string) => graph.variables.get(id)?.type
  const known = <T>(type: T | undefined) => {
    if (!type) throw new Error('Formula references a missing variable')
    return type
  }
  return foldFormula<VariableDataEntry>(node, {
    literal: (value) => variableValueToKiwi(graph, value, formulaValueType(value), ids),
    reference: (id) => variableValueToKiwi(graph, { aliasId: id }, known(typeOf(id)), ids),
    operation: (operation, operands) => ({
      dataType: 'EXPRESSION',
      resolvedDataType: known(inferFormulaType(operation, typeOf)),
      value: {
        expressionValue: {
          expressionFunction: figmaFormulaFunction(operation.operator),
          expressionArguments: operands
        }
      }
    })
  })
}

/**
 * Order keys for one parent, in call order. Collections, variables, shared styles and the
 * canvas's own layers all append to the internal canvas, so they share one sequence rather
 * than each numbering from zero and handing siblings the same key.
 */
export function sequentialPositions(start = 0): () => string {
  let index = start
  return () => fractionalPosition(index++)
}

export function appendVariableNodeChanges(
  graph: SceneGraph,
  changes: NodeChange[],
  parent: GUID,
  ids: Map<string, GUID>,
  modes: Map<string, GUID>,
  nextPosition: () => string = sequentialPositions()
): void {
  const modeKey = (modeId: string) => guidToString(modes.get(modeId) ?? stringToGuid(modeId))
  for (const collection of graph.variableCollections.values()) {
    const guid = ids.get(collection.id) ?? stringToGuid(collection.id)
    changes.push({
      guid,
      parentIndex: { guid: parent, position: nextPosition() },
      type: 'VARIABLE_SET',
      name: collection.name,
      phase: 'CREATED',
      strokeAlign: 'CENTER',
      strokeJoin: 'BEVEL',
      variableSetModes: modeSortPositions(modesDefaultFirst(collection)).map(
        ({ mode, sortPosition }) => ({
          id: modes.get(mode.modeId) ?? stringToGuid(mode.modeId),
          name: mode.name,
          sortPosition
        })
      ),
      pluginData: collectionPluginDataNodeChange(collection, modeKey),
      key: collection.key,
      version: collection.version
    })
    for (const id of collection.variableIds) {
      const variable = graph.variables.get(id)
      if (!variable) continue
      changes.push({
        guid: ids.get(id) ?? stringToGuid(id),
        parentIndex: { guid: parent, position: nextPosition() },
        type: 'VARIABLE',
        name: variable.name,
        phase: 'CREATED',
        strokeAlign: 'CENTER',
        strokeJoin: 'BEVEL',
        // A collection with a library key is named by it, as Figma names a library's.
        variableSetID: collection.key
          ? { assetRef: { key: collection.key, version: collection.version } }
          : { guid },
        variableResolvedType: variable.type,
        variableDataValues: {
          entries: Object.entries(variable.valuesByMode).map(([mode, value]) => ({
            modeID: modes.get(mode) ?? stringToGuid(mode),
            variableData: variableValueToKiwi(graph, value, variable.type, ids, modes)
          }))
        },
        ...variableMetadataNodeChange(variable, modeKey),
        key: variable.key,
        version: variable.version
      })
    }
  }
}
