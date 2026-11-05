import { omit } from 'es-toolkit/object'

import type { SceneNode } from './types'
import { effectBindableProperties, effectBindingTarget } from './variables/fields'

/** Whether an effect binding names a property its effect still has: a blur binds only radius. */
function bindsEffectProperty(node: SceneNode, key: string): boolean {
  const target = effectBindingTarget(key)
  const effect = target && node.effects.at(target.index)
  return !effect || effectBindableProperties(effect.type).includes(target.property)
}

export function removeStaleBindings(
  node: SceneNode,
  field: 'fills' | 'strokes' | 'effects',
  changes: Partial<SceneNode>
): void {
  const length = node[field].length
  const stale = Object.keys(node.boundVariables).filter((key) => {
    if (key === field) return true
    if (!key.startsWith(`${field}/`)) return false
    const index = Number.parseInt(key.split('/')[1] ?? '', 10)
    if (Number.isNaN(index) || index < 0 || index >= length) return true
    return field === 'effects' && !bindsEffectProperty(node, key)
  })
  if (stale.length === 0) return
  node.boundVariables = omit(node.boundVariables, stale)
  changes.boundVariables = { ...node.boundVariables }
}
