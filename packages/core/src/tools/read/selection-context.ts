import * as v from 'valibot'

import {
  copyEffects,
  copyFills,
  copyStrokes,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import { colorToHex8 } from '@open-pencil/scene-graph/color'

import type { FigmaAPI } from '#core/figma-api'
import { toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'
import { rasterizeNodes } from '#core/tools/vector/export'

const OVERVIEW_DEPTH = 2
const OVERVIEW_NODE_LIMIT = 150
const DETAIL_NODE_LIMIT = 200
const TEXT_PREVIEW_LIMIT = 200
const DETAIL_TEXT_LIMIT = 2_000

const DETAIL_CATEGORIES = [
  'geometry',
  'layout',
  'appearance',
  'typography',
  'content',
  'bindings'
] as const
type DetailCategory = (typeof DETAIL_CATEGORIES)[number]

interface OverviewNode {
  id: string
  name: string
  type: string
  width: number
  height: number
  childCount: number
  text?: string
  textTruncated?: boolean
  layout?: {
    mode: string
    gap: number
    padding: [number, number, number, number]
  }
  appearance?: { fill?: string; opacity?: number; cornerRadius?: number }
  children?: OverviewNode[]
  returnedChildCount?: number
  childrenTruncated?: boolean
}

interface TraversalEntry<T> {
  node: SceneNode
  result: T & { children?: T[]; returnedChildCount?: number; childrenTruncated?: boolean }
  depth: number
}

function compactText(text: string, limit: number): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false }
  return { text: text.slice(0, limit) + '…', truncated: true }
}

function overviewNode(node: SceneNode): OverviewNode {
  const result: OverviewNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    width: node.width,
    height: node.height,
    childCount: node.childIds.length
  }
  if (node.type === 'TEXT' && node.text) {
    const preview = compactText(node.text, TEXT_PREVIEW_LIMIT)
    result.text = preview.text
    if (preview.truncated) result.textTruncated = true
  }
  if (node.layoutMode !== 'NONE') {
    result.layout = {
      mode: node.layoutMode,
      gap: node.itemSpacing,
      padding: [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]
    }
  }
  const solid = node.fills.find((fill) => fill.visible && fill.type === 'SOLID')
  const appearance: NonNullable<OverviewNode['appearance']> = {}
  if (solid) appearance.fill = colorToHex8(solid.color, solid.opacity * solid.color.a)
  if (node.opacity !== 1) appearance.opacity = node.opacity
  if (node.cornerRadius > 0) appearance.cornerRadius = node.cornerRadius
  if (Object.keys(appearance).length > 0) result.appearance = appearance
  return result
}

function buildOverviewFromGraph(graph: SceneGraph, roots: SceneNode[]) {
  const selection: OverviewNode[] = []
  const queue: TraversalEntry<OverviewNode>[] = []
  let returnedNodeCount = 0
  let truncated = false
  for (const root of roots) {
    if (returnedNodeCount >= OVERVIEW_NODE_LIMIT) {
      truncated = true
      break
    }
    const result = overviewNode(root)
    selection.push(result)
    queue.push({ node: root, result, depth: 0 })
    returnedNodeCount++
  }
  while (queue.length > 0) {
    const entry = queue.shift()
    if (!entry || entry.depth >= OVERVIEW_DEPTH) continue
    const children: OverviewNode[] = []
    for (const child of graph.getChildren(entry.node.id)) {
      if (returnedNodeCount >= OVERVIEW_NODE_LIMIT) {
        truncated = true
        entry.result.childrenTruncated = true
        break
      }
      const result = overviewNode(child)
      children.push(result)
      queue.push({ node: child, result, depth: entry.depth + 1 })
      returnedNodeCount++
    }
    if (children.length > 0) entry.result.children = children
    if (entry.node.childIds.length > children.length) {
      entry.result.returnedChildCount = children.length
      entry.result.childrenTruncated = true
    }
  }
  return { selection, returnedNodeCount, truncated }
}

function resolveBindings(graph: SceneGraph, node: SceneNode) {
  return Object.fromEntries(
    Object.entries(node.boundVariables).map(([field, variableId]) => {
      const variable = graph.variables.get(variableId)
      return [
        field,
        {
          variableId,
          variableName: variable?.name ?? variableId,
          resolvedValue: variable ? graph.resolveVariable(variableId) : undefined
        }
      ]
    })
  )
}

function detailNode(graph: SceneGraph, node: SceneNode, include: Set<DetailCategory>) {
  const result: Record<string, unknown> & {
    children?: Array<Record<string, unknown>>
    returnedChildCount?: number
    childrenTruncated?: boolean
  } = { id: node.id, name: node.name, type: node.type, childCount: node.childIds.length }
  if (include.has('geometry')) {
    result.geometry = {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      rotation: node.rotation,
      absoluteBounds: graph.getAbsoluteBounds(node.id)
    }
  }
  if (include.has('layout')) {
    result.layout = {
      mode: node.layoutMode,
      direction: node.layoutDirection,
      wrap: node.layoutWrap,
      primaryAxisAlign: node.primaryAxisAlign,
      counterAxisAlign: node.counterAxisAlign,
      primaryAxisSizing: node.primaryAxisSizing,
      counterAxisSizing: node.counterAxisSizing,
      itemSpacing: node.itemSpacing,
      counterAxisSpacing: node.counterAxisSpacing,
      padding: [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
      positioning: node.layoutPositioning,
      grow: node.layoutGrow,
      alignSelf: node.layoutAlignSelf
    }
  }
  if (include.has('appearance')) {
    result.appearance = {
      fills: copyFills(node.fills),
      strokes: copyStrokes(node.strokes),
      effects: copyEffects(node.effects),
      opacity: node.opacity,
      blendMode: node.blendMode,
      cornerRadius: node.cornerRadius,
      cornerRadii: [
        node.topLeftRadius,
        node.topRightRadius,
        node.bottomRightRadius,
        node.bottomLeftRadius
      ],
      clipsContent: node.clipsContent,
      visible: node.visible
    }
  }
  if (include.has('typography') && node.type === 'TEXT') {
    result.typography = {
      fontFamily: node.fontFamily,
      fontSize: node.fontSize,
      fontWeight: node.fontWeight,
      italic: node.italic,
      lineHeight: node.lineHeight,
      letterSpacing: node.letterSpacing,
      textAlignHorizontal: node.textAlignHorizontal,
      textAlignVertical: node.textAlignVertical,
      textAutoResize: node.textAutoResize,
      textCase: node.textCase,
      textDecoration: node.textDecoration,
      maxLines: node.maxLines
    }
  }
  if (include.has('content') && node.text) {
    const preview = compactText(node.text, DETAIL_TEXT_LIMIT)
    result.content = { text: preview.text, truncated: preview.truncated }
  }
  if (include.has('bindings') && Object.keys(node.boundVariables).length > 0) {
    result.bindings = resolveBindings(graph, node)
  }
  return result
}

function isInsideSelection(figma: FigmaAPI, id: string): boolean {
  return figma.currentPage.selection.some((root) => figma.graph.isDescendant(id, root.id))
}

function normalizedRenderIds(figma: FigmaAPI): string[] {
  const selectedIds = figma.currentPage.selection.map((node) => node.id)
  const selectedSet = new Set(selectedIds)
  return selectedIds.filter((id) => {
    let current = figma.graph.getNode(id)
    while (current?.parentId) {
      if (selectedSet.has(current.parentId)) return false
      current = figma.graph.getNode(current.parentId)
    }
    return true
  })
}

export const seeUserSelection = defineTool({
  name: 'see_user_selection',
  description:
    'See the current user selection as a PNG plus a compact node tree through depth 2. Use the returned IDs with get_user_selection_details for focused inspection.',
  execution: { kind: 'async', mutation: 'none' },
  exposure: { ai: false, webmcp: false },
  input: v.object({}),
  execute: async (figma) => {
    const selected = figma.currentPage.selection
    if (selected.length === 0) {
      return {
        selectedCount: 0,
        selection: [],
        message: 'Nothing is currently selected. Ask the user to select one or more nodes.'
      }
    }
    const roots = selected
      .map((node) => figma.graph.getNode(node.id))
      .filter((node): node is SceneNode => node !== undefined)
    const overview = buildOverviewFromGraph(figma.graph, roots)
    const image = await rasterizeNodes(figma, normalizedRenderIds(figma), {
      format: 'PNG',
      scale: 1,
      maxEdge: 1280
    })
    if ('error' in image) {
      return {
        selectedCount: selected.length,
        selectedIds: selected.map((node) => node.id),
        ...overview,
        imageError: image.error
      }
    }
    return {
      selectedCount: selected.length,
      selectedIds: selected.map((node) => node.id),
      ...overview,
      image: { width: image.width, height: image.height, scale: image.scale },
      mimeType: image.mimeType,
      base64: image.base64,
      byteLength: image.byteLength
    }
  }
})

export const getUserSelectionDetails = defineTool({
  name: 'get_user_selection_details',
  description:
    'Get structured details for specific node IDs inside the current user selection. IDs are required and may identify selected nodes or descendants. Use depth 1 to discover children, then call again with only the relevant child IDs. Depth is limited to 3.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { ai: false, webmcp: false },
  input: v.object({
    ids: v.pipe(
      v.array(v.string()),
      v.minLength(1),
      v.maxLength(20),
      v.description('One to 20 node IDs returned by see_user_selection or a previous details call')
    ),
    depth: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.integer(),
          v.minValue(0),
          v.maxValue(3),
          v.description('Child depth to include: 0 for only the requested nodes, up to 3')
        )
      ),
      1
    ),
    include: v.optional(
      v.pipe(
        v.array(v.picklist(DETAIL_CATEGORIES)),
        v.minLength(1),
        v.description('Property categories to include')
      ),
      [...DETAIL_CATEGORIES]
    )
  }),
  execute: (figma, { ids, depth, include }) => {
    if (figma.currentPage.selection.length === 0) {
      return { error: 'Nothing is currently selected. Ask the user to select one or more nodes.' }
    }
    const requestedIds = [...new Set(ids)]
    const requestedNodes = requestedIds.map((id) => figma.graph.getNode(id))
    if (
      requestedNodes.some((node, index) => !node || !isInsideSelection(figma, requestedIds[index]))
    ) {
      throw new Error('One or more requested nodes are unavailable in the current user selection')
    }
    const requestedSet = new Set(requestedIds)
    const traversalRoots = requestedNodes.filter((node) => {
      if (!node) return false
      let current = node.parentId ? figma.graph.getNode(node.parentId) : undefined
      while (current) {
        if (requestedSet.has(current.id)) return false
        current = current.parentId ? figma.graph.getNode(current.parentId) : undefined
      }
      return true
    })
    const categories = new Set<DetailCategory>(include)
    const nodes: Array<Record<string, unknown>> = []
    const queue: TraversalEntry<Record<string, unknown>>[] = []
    const visited = new Set<string>()
    let returnedNodeCount = 0
    let truncated = false
    for (const node of traversalRoots) {
      if (!node || visited.has(node.id)) continue
      visited.add(node.id)
      const result = detailNode(figma.graph, node, categories)
      nodes.push(result)
      queue.push({ node, result, depth: 0 })
      returnedNodeCount++
    }
    while (queue.length > 0) {
      const entry = queue.shift()
      if (!entry || entry.depth >= depth) continue
      const children: Array<Record<string, unknown>> = []
      for (const child of figma.graph.getChildren(entry.node.id)) {
        if (visited.has(child.id)) continue
        if (returnedNodeCount >= DETAIL_NODE_LIMIT) {
          truncated = true
          entry.result.childrenTruncated = true
          break
        }
        visited.add(child.id)
        const result = detailNode(figma.graph, child, categories)
        children.push(result)
        queue.push({ node: child, result, depth: entry.depth + 1 })
        returnedNodeCount++
      }
      if (children.length > 0) entry.result.children = children
      if (entry.node.childIds.length > children.length) {
        entry.result.returnedChildCount = children.length
        entry.result.childrenTruncated = true
      }
    }
    return { requestedIds, nodes, returnedNodeCount, truncated }
  }
})
