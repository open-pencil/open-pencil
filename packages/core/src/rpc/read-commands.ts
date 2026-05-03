import { queryByXPath } from '#core/xpath'

import type { SceneGraph, SceneNode } from '#core/scene-graph'
import type { RpcCommand } from './types'

/** Walk descendants. Callback returns `false` to stop traversal. */
function walkNodes(graph: SceneGraph, rootId: string, fn: (node: SceneNode) => boolean): boolean {
  const node = graph.getNode(rootId)
  if (!node) return true
  if (!fn(node)) return false
  for (const childId of node.childIds) {
    if (!walkNodes(graph, childId, fn)) return false
  }
  return true
}

function countNodes(graph: SceneGraph, pageId: string): number {
  let count = 0
  const page = graph.getNode(pageId)
  if (page)
    for (const cid of page.childIds)
      walkNodes(graph, cid, () => {
        count++
        return true
      })
  return count
}

function nodeFrame(node: SceneNode) {
  return {
    x: Math.round(node.x),
    y: Math.round(node.y),
    width: Math.round(node.width),
    height: Math.round(node.height)
  }
}

// ── info ──

export interface InfoResult {
  pages: number
  totalNodes: number
  types: Record<string, number>
  fonts: string[]
  pageCounts: Record<string, number>
}

export const infoCommand: RpcCommand<void, InfoResult> = {
  name: 'info',
  execute: (graph) => {
    const pages = graph.getPages()
    let totalNodes = 0
    const types: Record<string, number> = {}
    const fonts = new Set<string>()
    const pageCounts: Record<string, number> = {}

    for (const page of pages) {
      let pageCount = 0
      for (const cid of page.childIds) {
        walkNodes(graph, cid, (node) => {
          totalNodes++
          pageCount++
          types[node.type] = (types[node.type] ?? 0) + 1
          if (node.fontFamily) fonts.add(node.fontFamily)
          return true
        })
      }
      pageCounts[page.name] = pageCount
    }

    return { pages: pages.length, totalNodes, types, fonts: [...fonts].sort(), pageCounts }
  }
}

// ── pages ──

export interface PageItem {
  id: string
  name: string
  nodes: number
}

export const pagesCommand: RpcCommand<void, PageItem[]> = {
  name: 'pages',
  execute: (graph) => {
    return graph.getPages().map((p) => ({ id: p.id, name: p.name, nodes: countNodes(graph, p.id) }))
  }
}

// ── tree ──

export interface TreeArgs {
  page?: string
  depth?: number
}

export interface TreeNodeResult {
  id: string
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  children?: TreeNodeResult[]
}

function buildTreeNode(
  graph: SceneGraph,
  id: string,
  depth: number,
  maxDepth: number
): TreeNodeResult | null {
  const node = graph.getNode(id)
  if (!node) return null
  const result: TreeNodeResult = {
    id: node.id,
    name: node.name,
    type: node.type,
    ...nodeFrame(node)
  }
  if (node.childIds.length > 0 && depth < maxDepth) {
    result.children = node.childIds
      .map((cid) => buildTreeNode(graph, cid, depth + 1, maxDepth))
      .filter((n): n is TreeNodeResult => n !== null)
  }
  return result
}

export interface TreeResult {
  page: { id: string; name: string; type: string }
  children: TreeNodeResult[]
}

export const treeCommand: RpcCommand<TreeArgs, TreeResult | { error: string }> = {
  name: 'tree',
  execute: (graph, args) => {
    const pages = graph.getPages()
    const maxDepth = args.depth ?? Infinity
    const page = args.page ? pages.find((p) => p.name === args.page) : pages[0]
    if (!page)
      return {
        error: `Page "${args.page}" not found. Available: ${pages.map((p) => p.name).join(', ')}`
      }

    return {
      page: { id: page.id, name: page.name, type: page.type },
      children: page.childIds
        .map((cid) => buildTreeNode(graph, cid, 0, maxDepth))
        .filter((n): n is TreeNodeResult => n !== null)
    }
  }
}

// ── find ──

export interface FindArgs {
  name?: string
  type?: string
  page?: string
  limit?: number
}

export interface FindNodeResult {
  id: string
  name: string
  type: string
  width: number
  height: number
}

export const findCommand: RpcCommand<FindArgs, FindNodeResult[]> = {
  name: 'find',
  execute: (graph, args) => {
    const pages = graph.getPages()
    const max = args.limit ?? 100
    const namePattern = args.name?.toLowerCase()
    const typeFilter = args.type?.toUpperCase()
    const results: FindNodeResult[] = []

    const searchPage = (page: SceneNode) => {
      for (const cid of page.childIds) {
        const cont = walkNodes(graph, cid, (node) => {
          if (results.length >= max) return false
          const matchesName = !namePattern || node.name.toLowerCase().includes(namePattern)
          const matchesType = !typeFilter || node.type === typeFilter
          if (matchesName && matchesType) {
            results.push({
              id: node.id,
              name: node.name,
              type: node.type,
              width: Math.round(node.width),
              height: Math.round(node.height)
            })
          }
          return true
        })
        if (!cont) break
      }
    }

    if (args.page) {
      const page = pages.find((p) => p.name === args.page)
      if (page) searchPage(page)
    } else {
      for (const page of pages) searchPage(page)
    }

    return results
  }
}

// ── query (xpath) ──

export interface QueryArgs {
  selector: string
  page?: string
  limit?: number
}

export interface QueryNodeResult {
  id: string
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
}

export const queryCommand: RpcCommand<QueryArgs, QueryNodeResult[] | { error: string }> = {
  name: 'query',
  execute: async (graph, args) => {
    try {
      const nodes = await queryByXPath(graph, args.selector, {
        page: args.page,
        limit: args.limit
      })
      return nodes.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        x: Math.round(n.x),
        y: Math.round(n.y),
        width: Math.round(n.width),
        height: Math.round(n.height)
      }))
    } catch (err) {
      return { error: `XPath error: ${err instanceof Error ? err.message : String(err)}` }
    }
  }
}

// ── node ──

export interface NodeArgs {
  id: string
}

export interface NodeResult {
  id: string
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  visible: boolean
  locked: boolean
  opacity: number
  rotation: number
  fills: unknown[]
  strokes: unknown[]
  effects: unknown[]
  cornerRadius: number
  blendMode: string
  layoutMode: string
  layoutDirection: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  textDirection: string
  text: string | null
  parent: { id: string; name: string; type: string } | null
  children: number
  boundVariables: Record<string, string>
}

export const nodeCommand: RpcCommand<NodeArgs, NodeResult | { error: string }> = {
  name: 'node',
  execute: (graph, args) => {
    const node = graph.getNode(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }

    const parent = node.parentId ? graph.getNode(node.parentId) : undefined
    const boundVars: Record<string, string> = {}
    for (const [field, varId] of Object.entries(node.boundVariables)) {
      const variable = graph.variables.get(varId)
      boundVars[field] = variable?.name ?? varId
    }

    return {
      id: node.id,
      name: node.name,
      type: node.type,
      ...nodeFrame(node),
      visible: node.visible,
      locked: node.locked,
      opacity: node.opacity,
      rotation: node.rotation,
      fills: node.fills,
      strokes: node.strokes,
      effects: node.effects,
      cornerRadius: node.cornerRadius,
      blendMode: node.blendMode,
      layoutMode: node.layoutMode,
      layoutDirection: node.layoutDirection,
      fontFamily: node.fontFamily,
      fontSize: node.fontSize,
      fontWeight: node.fontWeight,
      textDirection: node.textDirection,
      text: (() => {
        if (!node.text.length) return null
        if (node.text.length > 200) return node.text.slice(0, 200) + '…'
        return node.text
      })(),
      parent: parent ? { id: parent.id, name: parent.name, type: parent.type } : null,
      children: node.childIds.length,
      boundVariables: boundVars
    }
  }
}
