import {
  resolvedValueBindings,
  variableText,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

/**
 * Resolve values once occurrence hierarchy and modes exist. Visibility uses the
 * shared override-aware resolver. Text bindings supersede literal text overrides:
 * Figma saves resolved characters on a bound layer, but only the binding on an override.
 * Later variable and mode changes re-resolve these values through the editor.
 */
export function applyDocumentValueBindings(
  graph: SceneGraph,
  materialized: readonly SceneNode[]
): void {
  for (const node of materialized) {
    if (node.boundVariables.visible) {
      const { visible } = resolvedValueBindings(graph, node)
      if (visible !== undefined) graph.updateNode(node.id, { visible })
    }
    if (node.type !== 'TEXT') continue
    const variableId = node.boundVariables.text
    if (!variableId) continue
    const text = variableText(graph.resolveVariableForNode(node.id, variableId))
    if (text === undefined || text === node.text) continue
    graph.updateNode(node.id, { text })
  }
}
