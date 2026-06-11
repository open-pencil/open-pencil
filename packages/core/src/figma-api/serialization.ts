import type { SceneGraph, SceneNode } from '#core/scene-graph'

import type { NodeProxyHost } from './proxy'

function resolveBindings(graph: SceneGraph, node: SceneNode): Record<string, unknown> | undefined {
  const keys = Object.keys(node.boundVariables)
  if (keys.length === 0) return undefined
  const result: Record<string, unknown> = {}
  for (const [field, varId] of Object.entries(node.boundVariables)) {
    const variable = graph.variables.get(varId)
    result[field] = {
      variableId: varId,
      variableName: variable?.name ?? varId,
      resolvedValue: variable ? graph.resolveVariable(varId) : undefined
    }
  }
  return result
}

function appendTextProps(obj: Record<string, unknown>, n: SceneNode): void {
  obj.fontFamily = n.fontFamily
  obj.fontSize = n.fontSize
  obj.fontWeight = n.fontWeight
  obj.italic = n.italic
  obj.textAlignHorizontal = n.textAlignHorizontal
  obj.textAlignVertical = n.textAlignVertical
  obj.textAutoResize = n.textAutoResize
  obj.textDirection = n.textDirection
  if (n.lineHeight != null) obj.lineHeight = n.lineHeight
  if (n.letterSpacing !== 0) obj.letterSpacing = n.letterSpacing
  if (n.textCase !== 'ORIGINAL') obj.textCase = n.textCase
  if (n.textDecoration !== 'NONE') obj.textDecoration = n.textDecoration
  if (n.maxLines != null) obj.maxLines = n.maxLines
}

export function nodeProxyToJSON(
  graph: SceneGraph,
  api: NodeProxyHost,
  nodeId: string,
  maxDepth?: number,
  currentDepth = 0
): Record<string, unknown> {
  const n = graph.getNode(nodeId)
  if (!n) return { id: nodeId, removed: true }

  const obj: Record<string, unknown> = {
    id: n.id,
    type: n.type,
    name: n.name,
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height
  }
  if (n.fills.length > 0) obj.fills = n.fills
  if (n.strokes.length > 0) obj.strokes = n.strokes
  if (n.effects.length > 0) obj.effects = n.effects
  if (n.opacity !== 1) obj.opacity = n.opacity
  if (n.cornerRadius > 0) obj.cornerRadius = n.cornerRadius
  if (!n.visible) obj.visible = false
  if (n.text) obj.characters = n.text
  if (n.type === 'TEXT') {
    appendTextProps(obj, n)
  }
  if (n.layoutMode !== 'NONE') {
    obj.layoutMode = n.layoutMode
    obj.layoutDirection = n.layoutDirection
    obj.itemSpacing = n.itemSpacing
  }
  // Include variable bindings with resolved values
  const bindings = resolveBindings(graph, n)
  if (bindings) obj.boundVariables = bindings
  const children = graph.getChildren(nodeId)
  if (children.length > 0) {
    if (maxDepth !== undefined && currentDepth >= maxDepth) {
      obj.childCount = children.length
    } else {
      obj.children = children.map((child) =>
        api.wrapNode(child.id).toJSON(maxDepth, currentDepth + 1)
      )
    }
  }
  return obj
}
