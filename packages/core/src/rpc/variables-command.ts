import { colorToHex } from '#core/color'

import type { SceneGraph, Variable } from '#core/scene-graph'
import type { RpcCommand } from './types'

// ── variables ──

export interface VariablesArgs {
  collection?: string
  type?: string
}

function formatVariableValue(variable: Variable, graph: SceneGraph): string {
  const modeId = graph.getActiveModeId(variable.collectionId)
  const raw = variable.valuesByMode[modeId]

  if (typeof raw === 'object' && 'aliasId' in raw) {
    const alias = graph.variables.get(raw.aliasId)
    return alias ? `→ ${alias.name}` : `→ ${raw.aliasId}`
  }

  if (typeof raw === 'object' && 'r' in raw) {
    return colorToHex(raw).toLowerCase()
  }

  return String(raw)
}

export interface VariablesResult {
  collections: Array<{
    id: string
    name: string
    modes: string[]
    variables: Array<{
      id: string
      name: string
      type: string
      value: string
    }>
  }>
  totalVariables: number
  totalCollections: number
}

export const variablesCommand: RpcCommand<VariablesArgs, VariablesResult> = {
  name: 'variables',
  execute: (graph, args) => {
    const typeFilter = args.type?.toUpperCase()
    const collFilter = args.collection?.toLowerCase()

    const result: VariablesResult = {
      collections: [],
      totalVariables: graph.variables.size,
      totalCollections: graph.variableCollections.size
    }

    for (const coll of graph.variableCollections.values()) {
      if (collFilter && !coll.name.toLowerCase().includes(collFilter)) continue

      const collVars = graph
        .getVariablesForCollection(coll.id)
        .filter((v) => !typeFilter || v.type === typeFilter)

      if (collVars.length === 0) continue

      result.collections.push({
        id: coll.id,
        name: coll.name,
        modes: coll.modes.map((m) => m.name),
        variables: collVars.map((v) => ({
          id: v.id,
          name: v.name,
          type: v.type,
          value: formatVariableValue(v, graph)
        }))
      })
    }

    return result
  }
}

