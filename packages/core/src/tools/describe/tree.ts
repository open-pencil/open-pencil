import { detectIssues } from './issues'
import { detectRole } from './roles'
import { describeLayout, describeVisual, summarizeContainer, summarizeText } from './summaries'

import type { SceneGraph, SceneNode } from '#core/scene-graph'
import type { DescribeIssue } from './issues'

interface ChildDescription {
  role: string
  name: string
  summary: string
  id: string
  issues?: DescribeIssue[]
  children?: ChildDescription[]
}

function describeChild(
  node: SceneNode,
  graph: SceneGraph,
  depth: number,
  gridSize: number,
): ChildDescription {
  const role = detectRole(node)
  const summary = node.type === 'TEXT' ? summarizeText(node) : summarizeContainer(node)
  const result: ChildDescription = { role, name: node.name, summary, id: node.id }

  const issues = detectIssues(node, gridSize, graph)
  if (issues.length > 0) result.issues = issues

  if (depth > 0 && node.childIds.length > 0) {
    const kids: ChildDescription[] = []
    for (const childId of node.childIds) {
      const child = graph.getNode(childId)
      if (!child || !child.visible) continue
      kids.push(describeChild(child, graph, depth - 1, gridSize))
    }
    if (kids.length > 0) result.children = kids
  }
  return result
}

export function describeOneNode(
  figma: { graph: SceneGraph },
  nodeId: string,
  depth: number,
  gridSize: number,
): Record<string, unknown> {
  const raw = figma.graph.getNode(nodeId)
  if (!raw) return { id: nodeId, error: `Node "${nodeId}" not found` }

  const role = detectRole(raw)
  const visual = describeVisual(raw)
  const layout = describeLayout(raw)
  const issues = detectIssues(raw, gridSize, figma.graph)

  const children: ChildDescription[] = []
  for (const childId of raw.childIds) {
    const child = figma.graph.getNode(childId)
    if (!child || !child.visible) continue
    children.push(describeChild(child, figma.graph, depth - 1, gridSize))
  }

  const result: Record<string, unknown> = {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    role,
    size: `${raw.width}×${raw.height}`,
    visual,
  }
  if (layout) result.layout = layout
  if (children.length > 0) result.children = children
  if (issues.length > 0) result.issues = issues
  return result
}

function countDescendants(graph: SceneGraph, nodeId: string): number {
  const node = graph.getNode(nodeId)
  if (!node) return 0
  let count = 0
  for (const childId of node.childIds) {
    count += 1 + countDescendants(graph, childId)
  }
  return count
}

export function autoDepth(graph: SceneGraph, nodeId: string): number {
  const size = countDescendants(graph, nodeId)
  if (size <= 15) return 4
  if (size <= 40) return 3
  if (size <= 100) return 2
  return 1
}
