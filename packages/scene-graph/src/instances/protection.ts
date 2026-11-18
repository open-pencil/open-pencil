// What an instance's copy keeps through a sync: the fields it, or an instance around it, overrides.
import { isEmptyObject } from 'es-toolkit/predicate'

import type { SceneGraph } from '../graph'
import type { SceneNode } from '../types'
import { effectBindingTarget, paintBindingTarget } from '../variables/fields'
import { ownsSelfFillField } from './main-component'
import {
  bindingOverrideField,
  overriddenBindingField,
  type InstanceOverrideState
} from './overrides'

/** Protection for a copy that keeps nothing of its own. */
export const NOTHING_PROTECTED = (_field: string): boolean => false

export function bindingProtection(scopes: ReadonlySet<string>[]): (field: string) => boolean {
  const fields = new Set<string>()
  for (const scope of scopes) {
    const perField = [...scope].some((field) => overriddenBindingField(field) !== null)
    for (const field of scope) {
      if (field !== 'boundVariables' || !perField) fields.add(field)
    }
  }
  return (field) => {
    if (fields.has(field)) return true
    // Paints and effects an instance set itself own their bindings too, bound or not.
    const binding = overriddenBindingField(field)
    if (binding === null) return false
    const paint = paintBindingTarget(binding)
    if (paint) return fields.has(paint.list)
    return fields.has('effects') && effectBindingTarget(binding) !== null
  }
}

function isUnbound(node: SceneNode): boolean {
  return isEmptyObject(node.boundVariables) && isEmptyObject(node.variableBindingScales)
}

export function syncBindingFields(
  target: SceneNode,
  source: SceneNode,
  updates: Partial<SceneNode>,
  protectedField: (field: string) => boolean
): void {
  if (protectedField('boundVariables') || (isUnbound(source) && isUnbound(target))) {
    return
  }
  const bindings = { ...source.boundVariables }
  const scales = { ...source.variableBindingScales }
  for (const field of new Set([
    ...Object.keys(source.boundVariables),
    ...Object.keys(target.boundVariables),
    ...Object.keys(target.variableBindingScales)
  ])) {
    if (!protectedField(bindingOverrideField(field))) continue
    if (!Object.hasOwn(target.boundVariables, field)) Reflect.deleteProperty(bindings, field)
    else bindings[field] = target.boundVariables[field]
    if (target.variableBindingScales[field] === undefined) Reflect.deleteProperty(scales, field)
    else scales[field] = target.variableBindingScales[field]
  }
  updates.boundVariables = bindings
  updates.variableBindingScales = scales
}

export function isProtectedSyncField(
  node: SceneNode,
  key: string,
  protectedField: (field: string) => boolean
): boolean {
  return (
    protectedField(key) ||
    (key in node.boundVariables &&
      (protectedField('boundVariables') || protectedField(bindingOverrideField(key))))
  )
}

export function enclosingInstanceOverrideFields(graph: SceneGraph, node: SceneNode): Set<string>[] {
  const fields: Set<string>[] = []
  if (!node.parentId) return fields
  graph.closest(node.parentId, (ancestor) => {
    if (ancestor.type === 'INSTANCE') {
      fields.push(new Set(ancestor.instanceOverrides.descendants.get(node.id)?.keys()))
    }
    return false
  })
  return fields
}

/** The fields a copy keeps: its own overrides and those of every instance around it. */
export function childBindingProtection(
  graph: SceneGraph,
  child: SceneNode,
  overrides: InstanceOverrideState
) {
  const fields = enclosingInstanceOverrideFields(graph, child)
  fields.push(new Set(overrides.descendants.get(child.id)?.keys()))
  if (child.instanceOverrides.self.size === 0 && fields.every((scope) => scope.size === 0)) {
    return NOTHING_PROTECTED
  }
  const protectedField = bindingProtection(fields)
  return (field: string) => protectedField(field) || ownsSelfFillField(child, field)
}
