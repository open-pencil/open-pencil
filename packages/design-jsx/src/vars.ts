import type { Color, SceneGraph } from '@open-pencil/scene-graph'

const VAR_SYMBOL = Symbol.for('open-pencil.variable')

export type VarDef =
  | string
  | {
      id?: string
      name?: string
      value?: string | Color | number
    }

export interface DesignVariable {
  [VAR_SYMBOL]: true
  id?: string
  name: string
  value?: string | Color | number
}

export function resolveVariableId(graph: SceneGraph, variable: DesignVariable): string | undefined {
  if (variable.id && graph.variables.has(variable.id)) return variable.id
  if (variable.id && !variable.name) return variable.id
  for (const candidate of graph.variables.values()) {
    if (candidate.name === variable.name || candidate.id === variable.name) return candidate.id
  }
  return variable.id
}

export function isVariable(value: unknown): value is DesignVariable {
  return typeof value === 'object' && value !== null && VAR_SYMBOL in value
}

export function defineVars<T extends Record<string, VarDef>>(
  vars: T
): { [K in keyof T]: DesignVariable } {
  const result = {} as { [K in keyof T]: DesignVariable }

  for (const [key, def] of Object.entries(vars)) {
    result[key as keyof T] = designVar(def)
  }

  return result
}

export function designVar(def: VarDef): DesignVariable
export function designVar(idOrName: string, value?: DesignVariable['value']): DesignVariable
export function designVar(def: VarDef, value?: DesignVariable['value']): DesignVariable {
  if (typeof def === 'string') {
    return {
      [VAR_SYMBOL]: true,
      id: def,
      name: def,
      value
    }
  }

  return {
    [VAR_SYMBOL]: true,
    id: def.id,
    name: def.name ?? def.id ?? '',
    value: def.value
  }
}
