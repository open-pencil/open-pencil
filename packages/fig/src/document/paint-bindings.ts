import { copyFills, copyStrokes, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

/** Resolve bound paint colors only after occurrence hierarchy and modes are available. */
export function applyDocumentPaintBindings(
  graph: SceneGraph,
  materialized: readonly SceneNode[]
): void {
  for (const node of materialized) {
    // Most nodes bind nothing, so neither the entry array nor the change object is built
    // until a paint binding is actually found.
    let changes: Partial<SceneNode> | undefined
    for (const field in node.boundVariables) {
      if (!field.endsWith('/color')) continue
      const match = /^(fills|strokes)\/(\d+)\/color$/.exec(field)
      if (!match) continue
      const id = node.boundVariables[field]
      const kind = match[1] === 'fills' ? 'fills' : 'strokes'
      const index = Number(match[2])
      const color = graph.resolveColorVariableForNode(node.id, id)
      if (!color || !node[kind][index]) continue
      changes ??= {}
      if (kind === 'fills') {
        changes.fills ??= copyFills(node.fills)
        changes.fills[index].color = { ...color }
      } else {
        changes.strokes ??= copyStrokes(node.strokes)
        changes.strokes[index].color = { ...color }
      }
    }
    if (changes) graph.updateNode(node.id, changes)
  }
}
