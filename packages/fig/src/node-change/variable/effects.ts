import { omit } from 'es-toolkit/object'

import type { Effect as KiwiEffect, VariableAliasValue } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import {
  EFFECT_BINDING_PROPERTIES,
  effectBindableProperties,
  effectBindingField,
  effectBindingVariableType,
  type EffectBindingProperty
} from '@open-pencil/scene-graph/variables'

/** The field of a `.fig` effect that holds each property's variable alias. */
export const EFFECT_VARIABLE_FIELDS = {
  color: 'colorVar',
  radius: 'radiusVar',
  spread: 'spreadVar',
  offsetX: 'xVar',
  offsetY: 'yVar'
} as const satisfies Record<EffectBindingProperty, keyof KiwiEffect>

/** The aliases a `.fig` effect binds its properties to, library references included. */
export function effectVariableAliases(effect: KiwiEffect): VariableAliasValue[] {
  return EFFECT_BINDING_PROPERTIES.flatMap((property) => {
    const alias = effect[EFFECT_VARIABLE_FIELDS[property]]?.value?.alias
    return alias ? [alias] : []
  })
}

/**
 * The node binding fields the effects of a record bind, such as `effects/0/radius`, skipping an
 * alias on a property the effect does not have, such as a blur's colour.
 */
export function effectBindingsFromKiwi(effects: readonly KiwiEffect[]): Record<string, string> {
  const bindings: Record<string, string> = {}
  effects.forEach((effect, index) => {
    for (const property of effectBindableProperties(effect.type)) {
      const guid = effect[EFFECT_VARIABLE_FIELDS[property]]?.value?.alias?.guid
      if (guid) bindings[effectBindingField(index, property)] = guidToString(guid)
    }
  })
  return bindings
}

/**
 * `effect` with the aliases the node's bindings give the effect at `index`, and none for a
 * property the node does not bind, so an imported alias the document dropped is not written back.
 */
export function kiwiEffectWithBindings(
  effect: KiwiEffect,
  index: number,
  boundVariables: Readonly<Record<string, string>>,
  alias: (variableId: string) => VariableAliasValue
): KiwiEffect {
  const next: KiwiEffect = omit(effect, Object.values(EFFECT_VARIABLE_FIELDS))
  for (const property of EFFECT_BINDING_PROPERTIES) {
    const variableId = boundVariables[effectBindingField(index, property)]
    if (!variableId) continue
    next[EFFECT_VARIABLE_FIELDS[property]] = {
      dataType: 'ALIAS',
      resolvedDataType: effectBindingVariableType(property),
      value: { alias: alias(variableId) }
    }
  }
  return next
}
