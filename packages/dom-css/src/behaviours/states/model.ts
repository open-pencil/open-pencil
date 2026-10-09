import type { SceneGraphToDesignOptions } from '#dom-css/export/projection'
import type { DesignStyleDeclaration } from '#dom-css/types'
import { isEmptyObject, isEqual } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { variantConditions } from './conditions'
import {
  allElements,
  layersByKey,
  mergeVariant,
  projectVariant,
  stateElement,
  type VariantLayer
} from './layers'
import type { StateCondition, StateElement, StateRule, StateStyles } from './types'

/** Declarations `drawn` sets differently from `base`, with `unset` for ones it drops. */
export function difference(
  base: DesignStyleDeclaration,
  drawn: DesignStyleDeclaration
): DesignStyleDeclaration {
  const changed: DesignStyleDeclaration = {}
  for (const [property, value] of Object.entries(drawn))
    if (base[property] !== value) changed[property] = value
  for (const property of Object.keys(base)) if (!(property in drawn)) changed[property] = 'unset'
  return changed
}

/**
 * What a variant changes on a layer: what it draws differently, showing a layer hidden at
 * rest again, or hiding a layer it doesn't draw.
 */
function variantStyle(
  element: StateElement,
  layer: VariantLayer | undefined,
  hiddenAtRest: boolean
): DesignStyleDeclaration {
  if (!layer) return hiddenAtRest ? {} : { display: 'none' }
  const drawn = layer.element.inlineStyle ?? {}
  if (!hiddenAtRest) return difference(element.base, drawn)
  const display = Object.hasOwn(drawn, 'display') ? drawn.display : 'revert'
  return difference(element.base, { ...drawn, display })
}

const isPartOf = (part: StateCondition[], whole: StateCondition[]) =>
  part.length < whole.length &&
  part.every((condition) => whole.some((other) => isEqual(condition, other)))

/**
 * Drops what a combined variant repeats. A rule for checked + hover also gets the rules for
 * checked and for hover, so a declaration both of those already give with the same value
 * goes; one where they disagree or say nothing stays. Rules left empty go.
 */
function pruneCombined(rules: StateRule[]): StateRule[] {
  return rules.flatMap((rule) => {
    const parts = rules.filter((other) => isPartOf(other.conditions, rule.conditions))
    const repeated = (property: string, value: string) => {
      const given = parts.filter((part) => property in part.style)
      return given.length > 0 && given.every((part) => part.style[property] === value)
    }
    const style = Object.fromEntries(
      Object.entries(rule.style).filter(([property, value]) => !repeated(property, value))
    )
    return isEmptyObject(style) ? [] : [{ ...rule, style }]
  })
}

/**
 * The variants a behaviour's owner draws: a set's components, or a standalone component, such
 * as a radio group or tabs, which is its own only variant.
 */
export function ownerVariants(graph: SceneGraph, owner: SceneNode): SceneNode[] {
  if (owner.type === 'COMPONENT') return [owner]
  return graph.getChildren(owner.id).filter((child) => child.type === 'COMPONENT')
}

/**
 * A component set's variants as one markup tree with a rest style per layer and a rule per
 * variant holding only what that variant changes, under the conditions that show it. Layers
 * only some variants draw stay in the tree, hidden where absent.
 *
 * `null` when no variant shows the rest state, since every look then depends on a condition.
 */
export function stateStyles(
  graph: SceneGraph,
  set: SceneNode,
  options: Pick<SceneGraphToDesignOptions, 'vectorElement'> = {}
): StateStyles | null {
  const conditionsOf = variantConditions(graph, set)
  const variants = ownerVariants(graph, set)
    .filter((variant) => variant.visible)
    .flatMap((variant) => {
      const conditions = conditionsOf(variant)
      const root = conditions && projectVariant(graph, variant, options)
      return conditions && root ? [{ id: variant.id, conditions, root }] : []
    })
  const rest = variants.find((variant) => variant.conditions.length === 0)
  if (!rest) return null
  const others = variants.filter((variant) => variant !== rest)

  const root = stateElement(rest.root)
  const hiddenAtRest = new Set<StateElement>()
  for (const variant of others) mergeVariant(root, variant.root, hiddenAtRest)

  const elements = allElements(root)
  for (const variant of others) {
    const layers = layersByKey(variant.root)
    for (const element of elements) {
      const style = variantStyle(element, layers.get(element.key), hiddenAtRest.has(element))
      if (!isEmptyObject(style)) element.rules.push({ conditions: variant.conditions, style })
    }
  }
  for (const element of elements) element.rules = pruneCombined(element.rules)
  return { name: set.name, restId: rest.id, root }
}
