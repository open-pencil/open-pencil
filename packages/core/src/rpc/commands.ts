import { colorToHex, colorDistance as colorDist } from '../color'
import type { Color } from '../types'
import type { SceneGraph, SceneNode, Variable } from '../scene-graph'

export interface RpcCommand<A = unknown, R = unknown> {
  name: string
  execute: (graph: SceneGraph, args: A) => R
}

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
  if (page) for (const cid of page.childIds) walkNodes(graph, cid, () => { count++; return true })
  return count
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

function buildTreeNode(graph: SceneGraph, id: string, depth: number, maxDepth: number): TreeNodeResult | null {
  const node = graph.getNode(id)
  if (!node) return null
  const result: TreeNodeResult = {
    id: node.id,
    name: node.name,
    type: node.type,
    x: Math.round(node.x),
    y: Math.round(node.y),
    width: Math.round(node.width),
    height: Math.round(node.height)
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
    if (!page) return { error: `Page "${args.page}" not found. Available: ${pages.map((p) => p.name).join(', ')}` }

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
              id: node.id, name: node.name, type: node.type,
              width: Math.round(node.width), height: Math.round(node.height)
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
  fontFamily: string
  fontSize: number
  fontWeight: number
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
      x: Math.round(node.x),
      y: Math.round(node.y),
      width: Math.round(node.width),
      height: Math.round(node.height),
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
      fontFamily: node.fontFamily,
      fontSize: node.fontSize,
      fontWeight: node.fontWeight,
      text: node.text.length ? (node.text.length > 200 ? node.text.slice(0, 200) + '…' : node.text) : null,
      parent: parent ? { id: parent.id, name: parent.name, type: parent.type } : null,
      children: node.childIds.length,
      boundVariables: boundVars
    }
  }
}

// ── variables ──

export interface VariablesArgs {
  collection?: string
  type?: string
}

function formatVariableValue(variable: Variable, graph: SceneGraph): string {
  const modeId = graph.getActiveModeId(variable.collectionId)
  const raw = variable.valuesByMode[modeId]

  if (typeof raw === 'object' && 'aliasId' in raw) {
    const alias = graph.variables.get(raw.aliasId)
    return alias ? `→ ${alias.name}` : `→ ${raw.aliasId}`
  }

  if (typeof raw === 'object' && 'r' in raw) {
    return colorToHex(raw).toLowerCase()
  }

  return String(raw)
}

export interface VariablesResult {
  collections: Array<{
    id: string
    name: string
    modes: string[]
    variables: Array<{
      id: string
      name: string
      type: string
      value: string
    }>
  }>
  totalVariables: number
  totalCollections: number
}

export const variablesCommand: RpcCommand<VariablesArgs, VariablesResult> = {
  name: 'variables',
  execute: (graph, args) => {
    const typeFilter = args.type?.toUpperCase()
    const collFilter = args.collection?.toLowerCase()

    const result: VariablesResult = {
      collections: [],
      totalVariables: graph.variables.size,
      totalCollections: graph.variableCollections.size
    }

    for (const coll of graph.variableCollections.values()) {
      if (collFilter && !coll.name.toLowerCase().includes(collFilter)) continue

      const collVars = graph.getVariablesForCollection(coll.id)
        .filter((v) => !typeFilter || v.type === typeFilter)

      if (collVars.length === 0) continue

      result.collections.push({
        id: coll.id,
        name: coll.name,
        modes: coll.modes.map((m) => m.name),
        variables: collVars.map((v) => ({
          id: v.id,
          name: v.name,
          type: v.type,
          value: formatVariableValue(v, graph)
        }))
      })
    }

    return result
  }
}

// ── analyze colors ──

export interface AnalyzeColorsArgs {
  threshold?: number
  similar?: boolean
}

interface ColorInfo {
  hex: string
  color: Color
  count: number
  variableName: string | null
}

interface ColorCluster {
  colors: ColorInfo[]
  suggestedHex: string
  totalCount: number
}

function clusterColors(colors: ColorInfo[], threshold: number): ColorCluster[] {
  const clusters: ColorCluster[] = []
  const used = new Set<string>()
  const sorted = [...colors].sort((a, b) => b.count - a.count)

  for (const color of sorted) {
    if (used.has(color.hex)) continue
    const cluster: ColorCluster = { colors: [color], suggestedHex: color.hex, totalCount: color.count }
    used.add(color.hex)

    for (const other of sorted) {
      if (used.has(other.hex)) continue
      if (colorDist(color.color, other.color) <= threshold) {
        cluster.colors.push(other)
        cluster.totalCount += other.count
        used.add(other.hex)
      }
    }

    if (cluster.colors.length > 1) clusters.push(cluster)
  }

  return clusters.sort((a, b) => b.colors.length - a.colors.length)
}

function collectColors(graph: SceneGraph): { colors: ColorInfo[]; totalNodes: number } {
  const colorMap = new Map<string, ColorInfo>()
  let totalNodes = 0

  const addColor = (c: Color, variableName: string | null) => {
    const hex = colorToHex(c).toLowerCase()
    const existing = colorMap.get(hex)
    if (existing) {
      existing.count++
      if (variableName && !existing.variableName) existing.variableName = variableName
    } else {
      colorMap.set(hex, { hex, color: c, count: 1, variableName })
    }
  }

  for (const node of graph.getAllNodes()) {
    if (node.type === 'CANVAS') continue
    totalNodes++

    for (const fill of node.fills) {
      if (!fill.visible || fill.type !== 'SOLID') continue
      addColor(fill.color, null)
    }
    for (const stroke of node.strokes) {
      if (!stroke.visible) continue
      addColor(stroke.color, null)
    }
    for (const effect of node.effects) {
      if (!effect.visible) continue
      addColor(effect.color, null)
    }

    for (const [field, varId] of Object.entries(node.boundVariables)) {
      if (!field.includes('fill') && !field.includes('stroke') && !field.includes('color')) continue
      const variable = graph.variables.get(varId)
      if (variable) {
        const resolvedColor = graph.resolveColorVariable(varId)
        if (resolvedColor) {
          const hex = colorToHex(resolvedColor).toLowerCase()
          const existing = colorMap.get(hex)
          if (existing) existing.variableName = variable.name
        }
      }
    }
  }

  return { colors: [...colorMap.values()], totalNodes }
}

export interface AnalyzeColorsResult {
  colors: ColorInfo[]
  totalNodes: number
  clusters: ColorCluster[]
}

export const analyzeColorsCommand: RpcCommand<AnalyzeColorsArgs, AnalyzeColorsResult> = {
  name: 'analyze_colors',
  execute: (graph, args) => {
    const { colors, totalNodes } = collectColors(graph)
    const clusters = args.similar ? clusterColors(colors.filter((c) => !c.variableName), args.threshold ?? 15) : []
    return { colors: colors.sort((a, b) => b.count - a.count), totalNodes, clusters }
  }
}

// ── analyze typography ──

export interface AnalyzeTypographyArgs {}

export interface TypographyStyle {
  family: string
  size: number
  weight: number
  lineHeight: string
  count: number
}

export interface AnalyzeTypographyResult {
  styles: TypographyStyle[]
  totalTextNodes: number
}

export const analyzeTypographyCommand: RpcCommand<AnalyzeTypographyArgs, AnalyzeTypographyResult> = {
  name: 'analyze_typography',
  execute: (graph) => {
    const styleMap = new Map<string, TypographyStyle>()
    let totalTextNodes = 0

    for (const node of graph.getAllNodes()) {
      if (node.type !== 'TEXT') continue
      totalTextNodes++

      const lh = node.lineHeight === null ? 'auto' : `${node.lineHeight}px`
      const key = `${node.fontFamily}|${node.fontSize}|${node.fontWeight}|${lh}`
      const existing = styleMap.get(key)
      if (existing) { existing.count++ } else {
        styleMap.set(key, { family: node.fontFamily, size: node.fontSize, weight: node.fontWeight, lineHeight: lh, count: 1 })
      }
    }

    return { styles: [...styleMap.values()].sort((a, b) => b.count - a.count), totalTextNodes }
  }
}

// ── analyze spacing ──

export interface SpacingValue {
  value: number
  count: number
}

export interface AnalyzeSpacingResult {
  gaps: SpacingValue[]
  paddings: SpacingValue[]
  totalNodes: number
}

export const analyzeSpacingCommand: RpcCommand<void, AnalyzeSpacingResult> = {
  name: 'analyze_spacing',
  execute: (graph) => {
    const gapMap = new Map<number, number>()
    const paddingMap = new Map<number, number>()
    let totalNodes = 0

    for (const node of graph.getAllNodes()) {
      if (node.type === 'CANVAS' || node.layoutMode === 'NONE') continue
      totalNodes++

      if (node.itemSpacing > 0) gapMap.set(node.itemSpacing, (gapMap.get(node.itemSpacing) ?? 0) + 1)
      if (node.counterAxisSpacing > 0) gapMap.set(node.counterAxisSpacing, (gapMap.get(node.counterAxisSpacing) ?? 0) + 1)

      for (const pad of [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]) {
        if (pad > 0) paddingMap.set(pad, (paddingMap.get(pad) ?? 0) + 1)
      }
    }

    const toValues = (map: Map<number, number>) =>
      [...map.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count)

    return { gaps: toValues(gapMap), paddings: toValues(paddingMap), totalNodes }
  }
}

// ── analyze clusters ──

export interface AnalyzeClustersArgs {
  limit?: number
  minSize?: number
  minCount?: number
}

interface ClusterNode {
  id: string
  name: string
  type: string
  width: number
  height: number
  childCount: number
}

export interface AnalyzeClustersResult {
  clusters: Array<{
    signature: string
    nodes: ClusterNode[]
  }>
  totalNodes: number
}

function buildSignature(graph: SceneGraph, node: SceneNode): string {
  const childTypes = new Map<string, number>()
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child) continue
    childTypes.set(child.type, (childTypes.get(child.type) ?? 0) + 1)
  }
  const childPart = [...childTypes.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([t, c]) => `${t}:${c}`).join(',')
  const w = Math.round(node.width / 10) * 10
  const h = Math.round(node.height / 10) * 10
  return `${node.type}:${w}x${h}|${childPart}`
}

export const analyzeClustersCommand: RpcCommand<AnalyzeClustersArgs, AnalyzeClustersResult> = {
  name: 'analyze_clusters',
  execute: (graph, args) => {
    const minSize = args.minSize ?? 30
    const minCount = args.minCount ?? 2
    const limit = args.limit ?? 20
    const sigMap = new Map<string, ClusterNode[]>()
    let totalNodes = 0

    for (const node of graph.getAllNodes()) {
      if (node.type === 'CANVAS') continue
      totalNodes++
      if (node.width < minSize || node.height < minSize) continue
      if (node.childIds.length === 0) continue

      const sig = buildSignature(graph, node)
      const arr = sigMap.get(sig) ?? []
      arr.push({
        id: node.id, name: node.name, type: node.type,
        width: Math.round(node.width), height: Math.round(node.height), childCount: node.childIds.length
      })
      sigMap.set(sig, arr)
    }

    const clusters = [...sigMap.entries()]
      .filter(([, nodes]) => nodes.length >= minCount)
      .map(([signature, nodes]) => ({ signature, nodes }))
      .sort((a, b) => b.nodes.length - a.nodes.length)
      .slice(0, limit)

    return { clusters, totalNodes }
  }
}

// ── registry ──

export const ALL_RPC_COMMANDS = [
  infoCommand,
  pagesCommand,
  treeCommand,
  findCommand,
  nodeCommand,
  variablesCommand,
  analyzeColorsCommand,
  analyzeTypographyCommand,
  analyzeSpacingCommand,
  analyzeClustersCommand
] as RpcCommand[]

export function executeRpcCommand(graph: SceneGraph, name: string, args: unknown): unknown {
  const cmd = ALL_RPC_COMMANDS.find((c) => c.name === name)
  if (!cmd) throw new Error(`Unknown command: ${name}`)
  return cmd.execute(graph, args as never)
}
