import type { SceneGraph, Variable, VariableType } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'

import { exportTokenStylesheet, type TokenExport } from '#core/tools/codegen/tokens'

import type { RPCCommand } from './types'

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

export const variablesCommand: RPCCommand<VariablesArgs, VariablesResult> = {
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

// ── tokens ──

export interface TokensArgs {
  format?: string
  collection?: string
  type?: string
}

export type TokensResult = TokenExport

const VARIABLE_TYPES: readonly VariableType[] = ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']

function variableType(value: string | undefined): VariableType | undefined {
  if (!value) return undefined
  const type = VARIABLE_TYPES.find((candidate) => candidate === value.toUpperCase())
  if (!type) throw new Error(`Unknown variable type: ${value}. Use ${VARIABLE_TYPES.join(', ')}.`)
  return type
}

/** W3C design token files instead of a stylesheet, for `--format dtcg`. */
async function designTokenFiles(graph: SceneGraph): Promise<TokensResult> {
  const { designTokenIssueMessage, exportDesignTokens } =
    await import('#core/io/formats/design-tokens')
  const { files, issues } = exportDesignTokens(graph)
  return {
    css: '',
    tokenCount: graph.variables.size,
    issues: issues.map(designTokenIssueMessage),
    files
  }
}

export const tokensCommand: RPCCommand<TokensArgs, TokensResult> = {
  name: 'tokens',
  execute: (graph, args) => {
    if (args.format === 'dtcg') return designTokenFiles(graph)
    if (args.format && args.format !== 'css' && args.format !== 'tailwind')
      throw new Error(`Unknown token format: ${args.format}. Use css, tailwind, or dtcg.`)
    return exportTokenStylesheet(graph, {
      format: args.format === 'tailwind' ? 'tailwind' : 'css',
      collection: args.collection,
      type: variableType(args.type)
    })
  }
}
