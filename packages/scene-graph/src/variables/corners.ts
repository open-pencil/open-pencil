import { omit } from 'es-toolkit/object'

import type { SceneNode } from '../types'

const CORNERS = [
  'topLeftRadius',
  'topRightRadius',
  'bottomLeftRadius',
  'bottomRightRadius'
] as const

/**
 * The changes that draw a layer's radius corner by corner, as Figma keeps it once corners can
 * differ: each corner not bound on its own takes the radius the layer shows, and a binding of the
 * whole radius, which a .fig or .pen file holds as one field, moves to those corners, so each
 * corner can then change or be unbound alone.
 */
export function independentCornerChanges(node: SceneNode): Partial<SceneNode> {
  const changes: Partial<SceneNode> = {}
  if (!node.independentCorners) {
    changes.independentCorners = true
    // A corner bound on its own keeps the value its variable gave it.
    for (const corner of CORNERS)
      if (!node.boundVariables[corner]) changes[corner] = node.cornerRadius
  }
  const variableId = node.boundVariables.cornerRadius
  if (!variableId) return changes
  const unbound = CORNERS.filter((corner) => !node.boundVariables[corner])
  const scale = node.variableBindingScales.cornerRadius
  changes.boundVariables = {
    ...omit(node.boundVariables, ['cornerRadius']),
    ...Object.fromEntries(unbound.map((corner) => [corner, variableId]))
  }
  changes.variableBindingScales = {
    ...omit(node.variableBindingScales, ['cornerRadius']),
    ...(scale === undefined ? {} : Object.fromEntries(unbound.map((corner) => [corner, scale])))
  }
  return changes
}
