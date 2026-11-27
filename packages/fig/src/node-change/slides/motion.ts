import type * as v from 'valibot'

import type { NodeChange, VariableAliasValue } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { EASING_CURVES, type Easing, type EasingCurve } from '@open-pencil/scene-graph'
import { easingPreset } from '@open-pencil/scene-graph/variables'

import type { SceneNodeToKiwiContext } from '../export/context'
import { variableAlias } from '../variable/bindings'
import type { variableDataSchema } from './schema'

type VariableData = v.InferOutput<typeof variableDataSchema>

/** The variable a record's field follows, if it names one. */
export function variableOf(data: VariableData | undefined): string | undefined {
  const guid = data?.dataType === 'ALIAS' ? data.value?.alias?.guid : undefined
  return guid && guidToString(guid)
}

/** A field following a variable, as Figma writes it, or undefined for none or one now gone. */
export function variableRecord(
  context: SceneNodeToKiwiContext,
  variableId: string | undefined
): unknown {
  const variable = variableId ? context.graph.variables.get(variableId) : undefined
  // A deleted variable the document keeps is still written for the bindings it had.
  if (!variableId || !variable) return undefined
  return {
    dataType: 'ALIAS',
    resolvedDataType: variable.type,
    value: { alias: variableAlias(context.graph, variableId, context.varIdToGuid) }
  }
}

/**
 * A number a record stored as float32, as the shortest decimal that stores the same: 0.17 rather
 * than 0.17000000178813934, as Figma's panels show it.
 */
export function float32Decimal(value: number): number {
  const stored = Math.fround(value)
  for (let digits = 1; digits < 10; digits++) {
    const decimal = Number(stored.toPrecision(digits))
    if (Math.fround(decimal) === stored) return decimal
  }
  return value
}

function isEasingCurve(name: string): name is EasingCurve {
  return (EASING_CURVES as readonly string[]).includes(name)
}

/**
 * An action's easing: its name and, for a custom curve or spring, the numbers in
 * `easingFunction`: a curve's two control points, a spring's mass, stiffness and damping.
 */
export function easingFromAction(type: string | undefined, saved: readonly number[] = []): Easing {
  const numbers = saved.map(float32Decimal)
  if (type === 'CUSTOM_CUBIC' && numbers.length >= 4) {
    const [x1, y1, x2, y2] = numbers
    return { easing: 'CUSTOM_CUBIC', bezier: { x1, y1, x2, y2 } }
  }
  if (type === 'CUSTOM_SPRING' && numbers.length >= 3) {
    const [mass, stiffness, damping] = numbers
    return { easing: 'CUSTOM_SPRING', spring: { stiffness, damping, mass, type: 'PHYSICAL' } }
  }
  if (type && isEasingCurve(type) && !type.startsWith('CUSTOM_')) return easingPreset(type)
  return easingPreset('OUT_CUBIC')
}

/** The fields an action keeps for an easing, as Figma writes them. */
export function easingActionFields(easing: Easing): {
  easingType: EasingCurve
  easingFunction?: number[]
} {
  const { bezier, spring } = easing
  if (easing.easing === 'CUSTOM_CUBIC' && bezier) {
    return {
      easingType: 'CUSTOM_CUBIC',
      easingFunction: [bezier.x1, bezier.y1, bezier.x2, bezier.y2]
    }
  }
  // Figma writes a spring's starting speed last; OpenPencil's springs start at rest.
  if (easing.easing === 'CUSTOM_SPRING' && spring) {
    return {
      easingType: 'CUSTOM_SPRING',
      easingFunction: [spring.mass, spring.stiffness, spring.damping, 0]
    }
  }
  return { easingType: easing.easing }
}

/** The fields of transitions and layer animations that may follow a variable. */
const MOTION_VARIABLE_FIELDS = ['transitionDurationVar', 'easingVar', 'transitionTimeoutVar']

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function aliasOf(data: unknown): VariableAliasValue | undefined {
  if (!isObject(data) || !isObject(data.value) || !isObject(data.value.alias)) return undefined
  return data.value.alias
}

/**
 * The variable references of a record's transitions and layer animations, as the objects the
 * record holds, so a load can resolve a library variable's key to its record in place.
 */
export function motionVariableAliases(record: NodeChange): VariableAliasValue[] {
  const aliases: VariableAliasValue[] = []
  const interactions = [record.prototypeInteractions, record.objectAnimations]
    .filter(Array.isArray)
    .flat()
  for (const interaction of interactions) {
    if (!isObject(interaction)) continue
    const parts = [
      interaction.event,
      ...(Array.isArray(interaction.actions) ? interaction.actions : [])
    ]
    for (const part of parts) {
      if (!isObject(part)) continue
      for (const field of MOTION_VARIABLE_FIELDS) {
        const alias = aliasOf(part[field])
        if (alias) aliases.push(alias)
      }
    }
  }
  return aliases
}
