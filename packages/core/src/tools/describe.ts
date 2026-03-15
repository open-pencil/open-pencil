import { colorToHex } from '../color'
import { looksLikeButton } from './describe-shared'

import { detectIssues } from './describe-issues'

import type { DescribeIssue } from './describe-issues'
import { defineTool } from './schema'

import type { SceneGraph, SceneNode } from '../scene-graph'

const NAME_ROLE_PATTERNS: { pattern: RegExp; role: string }[] = [
  { pattern: /^icon$/i, role: 'icon' },
  { pattern: /^icon[-_]/i, role: 'icon' },
  { pattern: /^button$/i, role: 'button' },
  { pattern: /^btn[-_\s]/i, role: 'button' },
  { pattern: /[-_\s]btn$/i, role: 'button' },
  { pattern: /^cta$/i, role: 'button' },
  { pattern: /^icon[-_]?button$/i, role: 'button' },
  { pattern: /^link$/i, role: 'link' },
  { pattern: /^text[-_]?link$/i, role: 'link' },
  { pattern: /^input$/i, role: 'textbox' },
  { pattern: /^text[-_]?field$/i, role: 'textbox' },
  { pattern: /^search$/i, role: 'searchbox' },
  { pattern: /^checkbox$/i, role: 'checkbox' },
  { pattern: /^toggle$/i, role: 'switch' },
  { pattern: /^switch$/i, role: 'switch' },
  { pattern: /^radio$/i, role: 'radio' },
  { pattern: /^select$/i, role: 'combobox' },
  { pattern: /^dropdown$/i, role: 'combobox' },
  { pattern: /^slider$/i, role: 'slider' },
  { pattern: /^tab$/i, role: 'tab' },
  { pattern: /^tabs$/i, role: 'tablist' },
  { pattern: /^nav(bar|igation)?$/i, role: 'navigation' },
  { pattern: /^header$/i, role: 'banner' },
  { pattern: /^footer$/i, role: 'contentinfo' },
  { pattern: /^sidebar$/i, role: 'complementary' },
  { pattern: /^modal$/i, role: 'dialog' },
  { pattern: /^dialog$/i, role: 'dialog' },
  { pattern: /^tooltip$/i, role: 'tooltip' },
  { pattern: /^card$/i, role: 'article' },
  { pattern: /^avatar$/i, role: 'img' },
  { pattern: /^badge$/i, role: 'status' },
  { pattern: /^toast$/i, role: 'alert' },
  { pattern: /^alert$/i, role: 'alert' },
  { pattern: /^list$/i, role: 'list' },
  { pattern: /^menu$/i, role: 'menu' },
  { pattern: /^breadcrumb/i, role: 'navigation' },
  { pattern: /^progress$/i, role: 'progressbar' },
  { pattern: /^spinner$/i, role: 'progressbar' },
  { pattern: /^divider$/i, role: 'separator' },
  { pattern: /^separator$/i, role: 'separator' },
]

function detectRoleFromName(name: string): string | null {
  const base = (name.split(/[/,=]/)[0] ?? name).trim()
  for (const { pattern, role } of NAME_ROLE_PATTERNS) {
    if (pattern.test(base) || pattern.test(name)) return role
  }
  return null
}

function headingLevel(fontSize: number): number | null {
  if (fontSize >= 32) return 1
  if (fontSize >= 24) return 2
  if (fontSize >= 20) return 3
  if (fontSize >= 18) return 4
  return null
}

function looksLikeSeparator(node: SceneNode): boolean {
  if (node.width <= 2 && node.height > 10) return true
  if (node.height <= 2 && node.width > 10) return true
  const ratio = Math.max(node.width, node.height) / Math.max(1, Math.min(node.width, node.height))
  return ratio > 10 && Math.min(node.width, node.height) <= 4
}



function describeVisual(node: SceneNode): string {
  const parts: string[] = []
  const fill = node.fills.find((f) => f.type === 'SOLID' && f.visible)
  if (fill) parts.push(`${colorToHex(fill.color)} fill`)
  if (node.strokes.length > 0 && node.strokes[0]?.visible) parts.push('bordered')
  if (node.cornerRadius > 0) parts.push('rounded')
  if (node.clipsContent) parts.push('clipped')
  for (const e of node.effects) {
    if (!e.visible) continue
    if (e.type === 'DROP_SHADOW') parts.push('drop shadow')
    else if (e.type === 'INNER_SHADOW') parts.push('inner shadow')
    else if (e.type === 'LAYER_BLUR' || e.type === 'FOREGROUND_BLUR') parts.push('blurred')
    else parts.push('backdrop blur')
  }
  return parts.join(', ') || 'no visual styles'
}

const JUSTIFY_LABELS: Record<string, string> = {
  MIN: 'start', CENTER: 'center', MAX: 'end', SPACE_BETWEEN: 'between'
}

const ITEMS_LABELS: Record<string, string> = {
  MIN: 'start', CENTER: 'center', MAX: 'end', STRETCH: 'stretch', BASELINE: 'baseline'
}

function describeLayout(node: SceneNode): string | null {
  if (node.layoutMode === 'NONE') return null
  const dir = node.layoutMode === 'HORIZONTAL' ? 'horizontal' : 'vertical'
  const parts = [dir]
  if (node.primaryAxisAlign !== 'MIN') parts.push(`justify=${JUSTIFY_LABELS[node.primaryAxisAlign] ?? node.primaryAxisAlign}`)
  if (node.counterAxisAlign !== 'MIN') parts.push(`items=${ITEMS_LABELS[node.counterAxisAlign] ?? node.counterAxisAlign}`)
  if (node.itemSpacing > 0) parts.push(`${node.itemSpacing}px gap`)
  const pad = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]
  const allSame = pad.every((p) => p === pad[0])
  const first = pad[0]
  if (allSame && first > 0) parts.push(`${first}px padding`)
  else if (pad.some((p) => p > 0)) parts.push(`padding ${pad.join('/')}`)
  if (node.primaryAxisSizing !== 'FIXED') parts.push(`${node.primaryAxisSizing.toLowerCase()} main`)
  if (node.counterAxisSizing !== 'FIXED') parts.push(`${node.counterAxisSizing.toLowerCase()} cross`)
  if (node.layoutWrap === 'WRAP') parts.push('wrap')
  return parts.join(', ')
}

function detectRole(node: SceneNode): string {
  const nameDetected = detectRoleFromName(node.name)
  if (nameDetected) return nameDetected
  if (node.type === 'TEXT') {
    const level = headingLevel(node.fontSize)
    return level ? `heading(${level})` : 'StaticText'
  }
  if (looksLikeSeparator(node)) return 'separator'
  if (looksLikeButton(node)) return 'button'
  return 'generic'
}

interface ChildDescription {
  role: string
  name: string
  summary: string
  id: string
  issues?: DescribeIssue[]
  children?: ChildDescription[]
}

function summarizeContainer(node: SceneNode): string {
  const parts = [`${node.width}×${node.height}`]
  const fill = node.fills.find((f) => f.type === 'SOLID' && f.visible)
  if (fill) parts.push(colorToHex(fill.color))
  if (node.cornerRadius > 0) parts.push('rounded')
  const layout = describeLayout(node)
  if (layout) parts.push(layout)
  return parts.join(', ')
}

function summarizeText(node: SceneNode): string {
  const text = node.text.slice(0, 60)
  let summary = `"${text}" ${node.fontSize}px ${node.fontFamily}`
  if (node.fontWeight >= 700) summary += ' bold'
  else if (node.fontWeight >= 500) summary += ' medium'
  const textColor = node.fills.find((f) => f.type === 'SOLID' && f.visible)
  if (textColor) summary += `, ${colorToHex(textColor.color)}`
  if (node.textAutoResize === 'HEIGHT') summary += ', wraps'
  else if (node.textAutoResize === 'NONE') summary += ', fixed-size'
  if (node.maxLines !== null && node.maxLines > 0) summary += `, max ${node.maxLines} lines`
  return summary
}

function describeChild(node: SceneNode, graph: SceneGraph, depth: number, gridSize: number): ChildDescription {
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

function describeOneNode(
  figma: { graph: SceneGraph },
  nodeId: string,
  depth: number,
  gridSize: number
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

function autoDepth(graph: SceneGraph, nodeId: string): number {
  const size = countDescendants(graph, nodeId)
  if (size <= 15) return 4
  if (size <= 40) return 3
  if (size <= 100) return 2
  return 1
}

export const describe = defineTool({
  name: 'describe',
  description:
    'Semantic description of one or more nodes. Pass `id` for a single node, or `ids` for multiple nodes in one call. Omit depth for auto — adapts to subtree size (small block → deeper, large page → shallower).',
  params: {
    id: { type: 'string', description: 'Node ID (single node)' },
    ids: { type: 'string[]', description: 'Node IDs (multiple nodes in one call)' },
    depth: { type: 'number', description: 'Override depth (auto if omitted, max: 5)' },
    grid: { type: 'number', description: 'Grid size for alignment checks (default: 8)' }
  },
  execute: (figma, args) => {
    const gridSize = args.grid ?? 8

    if (args.ids && Array.isArray(args.ids)) {
      return {
        nodes: args.ids.map((nodeId) => {
          const depth = Math.min(args.depth ?? autoDepth(figma.graph, nodeId), 5)
          return describeOneNode(figma, nodeId, depth, gridSize)
        })
      }
    }

    if (!args.id) return { error: 'Provide id (string) or ids (string[])' }
    const depth = Math.min(args.depth ?? autoDepth(figma.graph, args.id), 5)
    return describeOneNode(figma, args.id, depth, gridSize)
  }
})
