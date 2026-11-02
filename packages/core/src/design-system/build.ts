import type { SceneGraph } from '@lawha/scene-graph'
import { colorToHex } from '@lawha/scene-graph/color'
import type { Color } from '@lawha/scene-graph/primitives'

import type { FigmaAPI } from '#core/figma-api'
import { LawhaAPI } from '#core/lawha-api'

import type { Use } from './extract'
import type { Plan } from './plan'

type VariableType = 'COLOR' | 'FLOAT' | 'STRING'
type Value = Color | number | string

export interface BuildOptions {
  collection: string
  /** Bind the variables to the layers that use each value. */
  apply: boolean
  /** Also bind near-duplicate colours, snapping them to their token. */
  normalize: boolean
}

export interface BuiltToken {
  name: string
  type: VariableType
  value: string | number
  id: string
  uses: number
}

export interface BuildResult {
  collection: string
  created: number
  updated: number
  bound: number
  normalized: number
  /** Uses that could not take a variable (an instance override, say) and keep their value. */
  skipped: number
  tokens: BuiltToken[]
  inconsistencies: { token: string; variants: string[] }[]
}

/** The named collection, created on first use; building again reuses it. */
function collectionFor(figma: FigmaAPI, name: string) {
  return (
    figma.variables.getLocalVariableCollections().find((c) => c.name === name) ??
    figma.variables.createVariableCollection(name)
  )
}

export function buildDesignSystem(figma: FigmaAPI, plan: Plan, options: BuildOptions): BuildResult {
  const collection = collectionFor(figma, options.collection)
  const existing = new Map(
    figma.variables
      .getLocalVariables()
      .filter((v) => v.variableCollectionId === collection.id)
      .map((v) => [v.name, v])
  )
  const lawha = new LawhaAPI(figma)
  const result: BuildResult = {
    collection: collection.id,
    created: 0,
    updated: 0,
    bound: 0,
    normalized: 0,
    skipped: 0,
    tokens: [],
    inconsistencies: []
  }

  const define = (name: string, type: VariableType, value: Value) => {
    let variable = existing.get(name)
    if (variable && variable.resolvedType !== type) variable = undefined
    if (variable) result.updated++
    else {
      variable = figma.variables.createVariable(name, collection.id, type)
      existing.set(name, variable)
      result.created++
    }
    for (const modeId of Object.keys(variable.valuesByMode)) variable.setValueForMode(modeId, value)
    return variable
  }

  const bind = (uses: readonly Use[], id: string, counter: 'bound' | 'normalized' = 'bound') => {
    if (!options.apply) return
    const variable = figma.variables.getVariableById(id)
    if (!variable) return
    for (const use of uses) {
      try {
        lawha.bindVariable(use.node, use.field, variable)
        result[counter]++
      } catch {
        result.skipped++
      }
    }
  }

  for (const token of plan.colors) {
    const v = define(token.name, 'COLOR', token.color)
    bind(token.uses, v.id)
    if (options.normalize) bind(token.nearUses, v.id, 'normalized')
    if (token.variants.length > 0)
      result.inconsistencies.push({ token: token.name, variants: token.variants })
    result.tokens.push({
      name: token.name,
      type: 'COLOR',
      value: colorToHex(token.color),
      id: v.id,
      uses: token.uses.length
    })
  }
  const familyVar = new Map<string, string>()
  for (const f of plan.families) {
    const v = define(f.name, 'STRING', f.family)
    familyVar.set(f.family, v.id)
    result.tokens.push({ name: f.name, type: 'STRING', value: f.family, id: v.id, uses: 0 })
  }
  for (const t of plan.type) {
    const size = define(`type/${t.name}/size`, 'FLOAT', t.sample.size)
    define(`type/${t.name}/weight`, 'FLOAT', t.sample.weight)
    bind(t.uses, size.id)
    const family = familyVar.get(t.sample.family)
    if (family)
      bind(
        t.uses.map((u) => ({ node: u.node, field: 'fontFamily' })),
        family
      )
    if (t.sample.lineHeight !== null) {
      const lh = define(`type/${t.name}/line-height`, 'FLOAT', t.sample.lineHeight)
      bind(
        t.uses.map((u) => ({ node: u.node, field: 'lineHeight' })),
        lh.id
      )
    }
    result.tokens.push({
      name: `type/${t.name}`,
      type: 'FLOAT',
      value: t.sample.size,
      id: size.id,
      uses: t.uses.length
    })
  }
  for (const token of [...plan.spacing, ...plan.radius]) {
    const v = define(token.name, 'FLOAT', token.value)
    bind(token.uses, v.id)
    result.tokens.push({
      name: token.name,
      type: 'FLOAT',
      value: token.value,
      id: v.id,
      uses: token.uses.length
    })
  }
  return result
}

/** Every layer on the page that the build bound to one of its variables. */
export function boundToCollection(graph: SceneGraph, collectionId: string): number {
  const ids = new Set(
    [...graph.variables.values()].filter((v) => v.collectionId === collectionId).map((v) => v.id)
  )
  let count = 0
  for (const node of graph.getAllNodes())
    for (const id of Object.values(node.boundVariables)) if (ids.has(id)) count++
  return count
}
