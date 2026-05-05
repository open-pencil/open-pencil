import { colorToHex, colorDistance as colorDist } from '#core/color'
import type { SceneGraph, SceneNode } from '#core/scene-graph'
import type { Color } from '#core/types'

import type { RpcCommand } from './types'

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
    const cluster: ColorCluster = {
      colors: [color],
      suggestedHex: color.hex,
      totalCount: color.count
    }
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
    const clusters = args.similar
      ? clusterColors(
          colors.filter((c) => !c.variableName),
          args.threshold ?? 15
        )
      : []
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

export const analyzeTypographyCommand: RpcCommand<AnalyzeTypographyArgs, AnalyzeTypographyResult> =
  {
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
        if (existing) {
          existing.count++
        } else {
          styleMap.set(key, {
            family: node.fontFamily,
            size: node.fontSize,
            weight: node.fontWeight,
            lineHeight: lh,
            count: 1
          })
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

      if (node.itemSpacing > 0)
        gapMap.set(node.itemSpacing, (gapMap.get(node.itemSpacing) ?? 0) + 1)
      if (node.counterAxisSpacing > 0)
        gapMap.set(node.counterAxisSpacing, (gapMap.get(node.counterAxisSpacing) ?? 0) + 1)

      for (const pad of [
        node.paddingTop,
        node.paddingRight,
        node.paddingBottom,
        node.paddingLeft
      ]) {
        if (pad > 0) paddingMap.set(pad, (paddingMap.get(pad) ?? 0) + 1)
      }
    }

    const toValues = (map: Map<number, number>) =>
      [...map.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)

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
  const childPart = [...childTypes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([t, c]) => `${t}:${c}`)
    .join(',')
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
        id: node.id,
        name: node.name,
        type: node.type,
        width: Math.round(node.width),
        height: Math.round(node.height),
        childCount: node.childIds.length
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
