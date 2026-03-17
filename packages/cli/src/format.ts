import {
  ok,
  fail,
  dim,
  bold,
  cyan,
  box as fmtBox,
  entity,
  kv,
  tree as fmtTree,
  list as fmtList,
  node as fmtNode,
  histogram as fmtHistogram,
  summary as fmtSummary
} from 'agentfmt'
import type { TreeNode, ListItem, NodeData } from 'agentfmt'
import type { SceneNode, SceneGraph } from '@open-pencil/core'

export { ok, fail, dim, bold, cyan, entity, kv, fmtTree, fmtList, fmtNode, fmtHistogram, fmtSummary }

export function printNodeResults(
  results: Array<{ type: string; name: string; id: string }>,
  formatLabel: (n: { type: string; name: string; id: string }) => string = (n) => n.name
): void {
  if (results.length === 0) {
    console.log('No nodes found.')
    return
  }
  console.log('')
  console.log(bold(`  Found ${results.length} node${results.length > 1 ? 's' : ''}`))
  console.log('')
  console.log(
    fmtList(
      results.map((n) => ({
        header: entity(formatType(n.type), formatLabel(n), n.id)
      }))
    )
  )
  console.log('')
}

const TYPE_LABELS: Record<string, string> = {
  FRAME: 'frame',
  RECTANGLE: 'rect',
  ROUNDED_RECTANGLE: 'rounded-rect',
  ELLIPSE: 'ellipse',
  TEXT: 'text',
  COMPONENT: 'component',
  COMPONENT_SET: 'component-set',
  INSTANCE: 'instance',
  GROUP: 'group',
  VECTOR: 'vector',
  LINE: 'line',
  POLYGON: 'polygon',
  STAR: 'star',
  BOOLEAN_OPERATION: 'boolean',
  SECTION: 'section',
  CANVAS: 'page'
}

export function formatType(type: string): string {
  return TYPE_LABELS[type] ?? type.toLowerCase()
}

export function formatBox(node: SceneNode): string {
  return fmtBox(Math.round(node.width), Math.round(node.height), Math.round(node.x), Math.round(node.y))
}

function formatFill(node: SceneNode): string | null {
  if (!node.fills.length) return null
  const solid = node.fills.find((f) => f.type === 'SOLID' && f.visible)
  if (!solid?.color) return null
  const { r, g, b } = solid.color
  const hex = '#' + [r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')
  return solid.opacity < 1 ? `${hex} ${Math.round(solid.opacity * 100)}%` : hex
}

function formatStroke(node: SceneNode): string | null {
  if (!node.strokes.length) return null
  const s = node.strokes[0]
  const { r, g, b } = s.color
  const hex = '#' + [r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')
  return `${hex} ${s.weight}px`
}

export function nodeToData(node: SceneNode): NodeData {
  return {
    type: formatType(node.type),
    name: node.name,
    id: node.id,
    width: Math.round(node.width),
    height: Math.round(node.height),
    x: Math.round(node.x),
    y: Math.round(node.y)
  }
}

export function nodeDetails(node: SceneNode): Record<string, unknown> {
  const details: Record<string, unknown> = {}

  const fill = formatFill(node)
  if (fill) details.fill = fill

  const stroke = formatStroke(node)
  if (stroke) details.stroke = stroke

  if (node.cornerRadius) details.radius = `${node.cornerRadius}px`

  if (node.effects.length > 0) {
    details.effects = node.effects
      .map((e) => {
        if (e.type === 'DROP_SHADOW') return `shadow(${e.radius}px)`
        if (e.type === 'INNER_SHADOW') return `inner-shadow(${e.radius}px)`
        if (e.type === 'LAYER_BLUR') return `blur(${e.radius}px)`
        if (e.type === 'BACKGROUND_BLUR') return `backdrop-blur(${e.radius}px)`
        return e.type.toLowerCase()
      })
      .join(', ')
  }

  if (node.rotation) details.rotate = `${Math.round(node.rotation)}°`
  if (node.opacity < 1) details.opacity = node.opacity
  if (node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL') {
    details.blend = node.blendMode.toLowerCase().replace(/_/g, '-')
  }
  if (node.clipsContent) details.overflow = 'hidden'
  if (!node.visible) details.visible = false
  if (node.locked) details.locked = true

  if (node.fontFamily) {
    details.font = `${node.fontSize}px ${node.fontFamily}`
  }

  if (node.layoutMode !== 'NONE') {
    let layout = node.layoutMode.toLowerCase()
    if (node.layoutWrap === 'WRAP') layout += ' wrap'
    if (node.itemSpacing) layout += ` gap=${node.itemSpacing}`
    details.layout = layout
  }

  if (node.componentId) details.componentId = node.componentId

  return details
}

export function nodeToTreeNode(graph: SceneGraph, node: SceneNode, maxDepth: number, depth = 0): TreeNode {
  const treeNode: TreeNode = {
    header: entity(formatType(node.type), node.name, node.id),
    details: nodeDetails(node)
  }

  if (depth < maxDepth && node.childIds.length > 0) {
    treeNode.children = node.childIds
      .map((id) => graph.getNode(id))
      .filter((n): n is SceneNode => n !== undefined)
      .map((child) => nodeToTreeNode(graph, child, maxDepth, depth + 1))
  }

  return treeNode
}

export function nodeToListItem(node: SceneNode): ListItem {
  const details = nodeDetails(node)
  return {
    header: entity(formatType(node.type), node.name, node.id),
    details: Object.keys(details).length > 0 ? details : undefined
  }
}

export function formatNodeSingle(node: SceneNode): string {
  return fmtNode(nodeToData(node), nodeDetails(node))
}

export function printError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(fail(message))
}
