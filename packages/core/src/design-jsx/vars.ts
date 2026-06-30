import type { Color } from '@open-pencil/scene-graph/primitives'

const VAR_SYMBOL = Symbol.for('open-pencil.variable')

export type VarDef =
  | string
  | {
      id?: string
      name?: string
      value?: string | Color
    }

export interface DesignVariable {
  [VAR_SYMBOL]: true
  id?: string
  name: string
  value?: string | Color
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

export function designVar(
  def: string | { id?: string; name?: string; value?: string | Color }
): DesignVariable
export function designVar(idOrName: string, value?: string | Color): DesignVariable
export function designVar(
  def: string | { id?: string; name?: string; value?: string | Color },
  value?: string | Color
): DesignVariable {
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
