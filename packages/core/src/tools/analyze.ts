import { createTwoFilesPatch } from 'diff'

import { colorDistance, colorToHex, parseColor } from '../color'

import { defineTool } from './schema'

import type { Color } from '../types'
import type { SceneNode } from '../scene-graph'
import type { FigmaAPI } from '../figma-api'

interface ColorEntry {
  hex: string
  color: Color
  count: number
  variableName: string | null
}

function trackColor(
  colorMap: Map<string, ColorEntry>,
  color: Color,
  variableName: string | null
) {
  const hex = colorToHex(color)
  const entry = colorMap.get(hex)
  if (entry) {
    entry.count++
    if (!entry.variableName && variableName) entry.variableName = variableName
  } else {
    colorMap.set(hex, { hex, color, count: 1, variableName })
  }
}

// ─── Diff helpers ─────────────────────────────────────────────

function serializePaintProps(raw: SceneNode, lines: string[]): void {
  const solidFill = raw.fills.find((f) => f.type === 'SOLID' && f.visible)
  if (solidFill) lines.push(`fill: ${colorToHex(solidFill.color)}`)

  const solidStroke = raw.strokes.find((s) => s.visible)
  if (solidStroke) {
    lines.push(`stroke: ${colorToHex(solidStroke.color)}`)
    if (solidStroke.weight) lines.push(`strokeWeight: ${solidStroke.weight}`)
  }
}

function serializeCornerRadii(raw: SceneNode, lines: string[]): void {
  const tl = raw.topLeftRadius
  const tr = raw.topRightRadius
  const br = raw.bottomRightRadius
  const bl = raw.bottomLeftRadius
  if (tl || tr || br || bl) {
    if (tl === tr && tr === br && br === bl) {
      lines.push(`radius: ${tl}`)
    } else {
      lines.push(`radii: ${tl} ${tr} ${br} ${bl}`)
    }
  }
}

function serializeEffects(raw: SceneNode, lines: string[]): void {
  for (const effect of raw.effects) {
    const parts: string[] = [effect.type]
    parts.push(`r=${effect.radius}`)
    parts.push(`c=${colorToHex(effect.color)}`)
    parts.push(`x=${effect.offset.x} y=${effect.offset.y}`)
    parts.push(`s=${effect.spread}`)
    lines.push(`effect: ${parts.join(' ')}`)
  }
}

function serializeTextProps(raw: SceneNode, lines: string[]): void {
  if (raw.type !== 'TEXT') return
  if (raw.text) lines.push(`text: ${JSON.stringify(raw.text)}`)
  if (raw.fontSize) lines.push(`fontSize: ${raw.fontSize}`)
  if (raw.fontFamily) lines.push(`fontFamily: ${raw.fontFamily}`)
  if (raw.fontWeight) lines.push(`fontWeight: ${raw.fontWeight}`)
}

function serializeNodeProps(raw: SceneNode): string {
  const lines: string[] = []
  lines.push(`type: ${raw.type}`)
  lines.push(`size: ${raw.width} ${raw.height}`)
  lines.push(`pos: ${raw.x} ${raw.y}`)

  serializePaintProps(raw, lines)

  if (raw.opacity !== 1) lines.push(`opacity: ${Math.round(raw.opacity * 100) / 100}`)

  serializeCornerRadii(raw, lines)

  if (raw.blendMode !== 'NORMAL') lines.push(`blendMode: ${raw.blendMode}`)
  if (raw.rotation !== 0) lines.push(`rotation: ${Math.round(raw.rotation * 100) / 100}`)
  if (raw.clipsContent) lines.push(`clipsContent: true`)

  serializeEffects(raw, lines)
  serializeTextProps(raw, lines)

  if (!raw.visible) lines.push(`visible: false`)
  if (raw.locked) lines.push(`locked: true`)

  return lines.join('\n')
}

function collectNodeTree(
  figma: FigmaAPI,
  nodeId: string,
  parentPath: string,
  depth: number,
  maxDepth: number
): Map<string, { path: string; id: string; serialized: string }> {
  const result = new Map<string, { path: string; id: string; serialized: string }>()
  const raw = figma.graph.getNode(nodeId)
  if (!raw) return result

  const path = parentPath ? `${parentPath}/${raw.name}` : `/${raw.name}`
  result.set(path, { path, id: raw.id, serialized: serializeNodeProps(raw) })

  if (depth < maxDepth) {
    for (const childId of raw.childIds) {
      const childNodes = collectNodeTree(figma, childId, path, depth + 1, maxDepth)
      for (const [k, v] of childNodes) result.set(k, v)
    }
  }
  return result
}

function createUnifiedDiff(
  oldFilename: string,
  newFilename: string,
  oldContent: string,
  newContent: string
): string {
  const patch = createTwoFilesPatch(oldFilename, newFilename, oldContent, newContent, '', '')
  return patch
    .split('\n')
    .filter((l) => !l.startsWith('Index:') && l !== '===================================================================')
    .join('\n')
    .trim()
}

// ─── Analyze tools ────────────────────────────────────────────

export const analyzeColors = defineTool({
  name: 'analyze_colors',
  description:
    'Analyze color palette usage across the current page. Shows frequency, variable bindings, and optionally clusters similar colors.',
  params: {
    limit: { type: 'number', description: 'Max colors to return (default: 30)' },
    show_similar: {
      type: 'boolean',
      description: 'Include similar-color clusters for potential merging'
    },
    threshold: {
      type: 'number',
      description: 'Distance threshold for clustering (0-50, default: 15)'
    }
  },
  execute: (figma, args) => {
    const limit = args.limit ?? 30
    const threshold = args.threshold ?? 15
    const page = figma.currentPage
    const colorMap = new Map<string, ColorEntry>()
    let totalNodes = 0

    page.findAll((node) => {
      totalNodes++
      const raw = figma.graph.getNode(node.id)
      if (!raw) return false

      const boundVars = raw.boundVariables
      for (const fill of raw.fills) {
        if (fill.type === 'SOLID' && fill.visible) {
          trackColor(colorMap, fill.color, boundVars['fills'] ? String(boundVars['fills']) : null)
        }
      }
      for (const stroke of raw.strokes) {
        if (stroke.visible) {
          trackColor(colorMap, stroke.color, boundVars['strokes'] ? String(boundVars['strokes']) : null)
        }
      }
      return false
    })

    const colors = [...colorMap.values()].sort((a, b) => b.count - a.count).slice(0, limit)

    const result: Record<string, unknown> = {
      totalNodes,
      uniqueColors: colorMap.size,
      colors: colors.map((c) => ({ hex: c.hex, count: c.count, variableName: c.variableName }))
    }

    if (args.show_similar) {
      const hardcoded = [...colorMap.values()]
        .filter((c) => !c.variableName)
        .sort((a, b) => b.count - a.count)
      const used = new Set<string>()
      const clusters: { colors: string[]; totalCount: number; suggestedHex: string }[] = []

      for (const color of hardcoded) {
        if (used.has(color.hex)) continue
        const cluster = [color]
        used.add(color.hex)
        for (const other of hardcoded) {
          if (used.has(other.hex)) continue
          if (colorDistance(color.color, other.color) <= threshold) {
            cluster.push(other)
            used.add(other.hex)
          }
        }
        if (cluster.length > 1) {
          clusters.push({
            colors: cluster.map((c) => c.hex),
            totalCount: cluster.reduce((sum, c) => sum + c.count, 0),
            suggestedHex: color.hex
          })
        }
      }

      result.similarClusters = clusters.sort((a, b) => b.colors.length - a.colors.length)
    }

    return result
  }
})

export const analyzeTypography = defineTool({
  name: 'analyze_typography',
  description:
    'Analyze typography usage across the current page. Shows font families, sizes, weights, and their frequencies.',
  params: {
    limit: { type: 'number', description: 'Max styles to return (default: 30)' },
    group_by: {
      type: 'string',
      description: 'Group results by a property',
      enum: ['family', 'size', 'weight']
    }
  },
  execute: (figma, args) => {
    const limit = args.limit ?? 30
    const page = figma.currentPage
    const styleMap = new Map<
      string,
      { family: string; size: number; weight: number; lineHeight: string; count: number }
    >()
    let totalTextNodes = 0

    page.findAll((node) => {
      if (node.type !== 'TEXT') return false
      totalTextNodes++
      const raw = figma.graph.getNode(node.id)
      if (!raw) return false
      const lh = raw.lineHeight === null ? 'auto' : `${raw.lineHeight}`
      const key = `${raw.fontFamily}|${raw.fontSize}|${raw.fontWeight}|${lh}`
      const entry = styleMap.get(key)
      if (entry) {
        entry.count++
      } else {
        styleMap.set(key, {
          family: raw.fontFamily,
          size: raw.fontSize,
          weight: raw.fontWeight,
          lineHeight: lh,
          count: 1
        })
      }
      return false
    })

    const styles = [...styleMap.values()].sort((a, b) => b.count - a.count)

    if (args.group_by === 'family') {
      const byFamily = new Map<string, number>()
      for (const s of styles) byFamily.set(s.family, (byFamily.get(s.family) ?? 0) + s.count)
      return {
        totalTextNodes,
        groups: [...byFamily.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([family, count]) => ({ family, count }))
      }
    }

    if (args.group_by === 'size') {
      const bySize = new Map<number, number>()
      for (const s of styles) bySize.set(s.size, (bySize.get(s.size) ?? 0) + s.count)
      return {
        totalTextNodes,
        groups: [...bySize.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([size, count]) => ({ size, count }))
      }
    }

    if (args.group_by === 'weight') {
      const byWeight = new Map<number, number>()
      for (const s of styles) byWeight.set(s.weight, (byWeight.get(s.weight) ?? 0) + s.count)
      return {
        totalTextNodes,
        groups: [...byWeight.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([weight, count]) => ({ weight, count }))
      }
    }

    return {
      totalTextNodes,
      uniqueStyles: styleMap.size,
      styles: styles.slice(0, limit)
    }
  }
})

export const analyzeSpacing = defineTool({
  name: 'analyze_spacing',
  description:
    'Analyze spacing values (gap, padding) across the current page. Checks grid compliance.',
  params: {
    grid: { type: 'number', description: 'Base grid size to check against (default: 8)' }
  },
  execute: (figma, args) => {
    const gridSize = args.grid ?? 8
    const page = figma.currentPage
    const gapMap = new Map<number, number>()
    const paddingMap = new Map<number, number>()
    let totalNodes = 0

    page.findAll((node) => {
      totalNodes++
      const raw = figma.graph.getNode(node.id)
      if (!raw) return false

      if (raw.layoutMode !== 'NONE' && raw.itemSpacing > 0) {
        gapMap.set(raw.itemSpacing, (gapMap.get(raw.itemSpacing) ?? 0) + 1)
      }

      for (const p of [raw.paddingTop, raw.paddingRight, raw.paddingBottom, raw.paddingLeft]) {
        if (p > 0) {
          paddingMap.set(p, (paddingMap.get(p) ?? 0) + 1)
        }
      }
      return false
    })

    const gaps = [...gapMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count, onGrid: value % gridSize === 0 }))

    const paddings = [...paddingMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count, onGrid: value % gridSize === 0 }))

    const offGridGaps = gaps.filter((g) => !g.onGrid)
    const offGridPaddings = paddings.filter((p) => !p.onGrid)

    return {
      totalNodes,
      gridSize,
      gaps,
      paddings,
      offGridGaps: offGridGaps.map((g) => g.value),
      offGridPaddings: offGridPaddings.map((p) => p.value)
    }
  }
})

export const analyzeClusters = defineTool({
  name: 'analyze_clusters',
  description:
    'Find repeated design patterns (potential components). Groups nodes by structural signature — type, size, and child structure.',
  params: {
    min_count: { type: 'number', description: 'Min instances to form a cluster (default: 2)' },
    min_size: { type: 'number', description: 'Min node size in px (default: 30)' },
    limit: { type: 'number', description: 'Max clusters to return (default: 20)' }
  },
  execute: (figma, args) => {
    const minCount = args.min_count ?? 2
    const minSize = args.min_size ?? 30
    const limit = args.limit ?? 20
    const page = figma.currentPage

    const signatureMap = new Map<
      string,
      { id: string; name: string; type: string; width: number; height: number; childCount: number }[]
    >()
    let totalNodes = 0

    page.findAll((node) => {
      totalNodes++
      const raw = figma.graph.getNode(node.id)
      if (!raw) return false
      if (raw.width < minSize || raw.height < minSize) return false
      if (raw.type === 'CANVAS' || raw.type === 'INSTANCE') return false

      const childTypes = new Map<string, number>()
      for (const childId of raw.childIds) {
        const child = figma.graph.getNode(childId)
        if (child) childTypes.set(child.type, (childTypes.get(child.type) ?? 0) + 1)
      }

      const w = Math.round(raw.width / 10) * 10
      const h = Math.round(raw.height / 10) * 10
      const childSig = [...childTypes.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([t, c]) => `${t}:${c}`)
        .join(',')
      const signature = `${raw.type}:${w}x${h}|${childSig}`

      const list = signatureMap.get(signature) ?? []
      list.push({
        id: raw.id,
        name: raw.name,
        type: raw.type,
        width: raw.width,
        height: raw.height,
        childCount: raw.childIds.length
      })
      signatureMap.set(signature, list)
      return false
    })

    const clusters = [...signatureMap.entries()]
      .filter(([, nodes]) => nodes.length >= minCount)
      .map(([signature, nodes]) => {
        const avgW = nodes.reduce((s, n) => s + n.width, 0) / nodes.length
        const avgH = nodes.reduce((s, n) => s + n.height, 0) / nodes.length
        const widths = nodes.map((n) => n.width)
        const heights = nodes.map((n) => n.height)
        const widthRange = Math.max(...widths) - Math.min(...widths)
        const heightRange = Math.max(...heights) - Math.min(...heights)

        let confidence = 100
        if (nodes.length >= 2) {
          const base = nodes[0]
          let score = 0
          for (const n of nodes.slice(1)) {
            const sizeDiff = Math.abs(n.width - base.width) + Math.abs(n.height - base.height)
            const childDiff = Math.abs(n.childCount - base.childCount)
            if (sizeDiff <= 4 && childDiff === 0) score++
            else if (sizeDiff <= 10 && childDiff <= 1) score += 0.8
            else if (sizeDiff <= 20 && childDiff <= 2) score += 0.6
            else score += 0.4
          }
          confidence = Math.round((score / (nodes.length - 1)) * 100)
        }

        return {
          signature,
          count: nodes.length,
          avgWidth: Math.round(avgW),
          avgHeight: Math.round(avgH),
          widthRange: Math.round(widthRange),
          heightRange: Math.round(heightRange),
          confidence,
          examples: nodes.slice(0, 3).map((n) => ({ id: n.id, name: n.name }))
        }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    return { totalNodes, clusters }
  }
})

// ─── Diff tools ───────────────────────────────────────────────

export const diffCreate = defineTool({
  name: 'diff_create',
  description:
    'Create a structural diff between two node trees. Compares properties (fills, strokes, effects, text, size, position) in unified diff format.',
  params: {
    from: { type: 'string', description: 'Source node ID', required: true },
    to: { type: 'string', description: 'Target node ID', required: true },
    depth: { type: 'number', description: 'Max tree depth (default: 10)' }
  },
  execute: (figma, args) => {
    const maxDepth = args.depth ?? 10
    const fromNode = figma.graph.getNode(args.from)
    const toNode = figma.graph.getNode(args.to)
    if (!fromNode) return { error: `Node "${args.from}" not found` }
    if (!toNode) return { error: `Node "${args.to}" not found` }

    const fromNodes = collectNodeTree(figma, args.from, '', 0, maxDepth)
    const toNodes = collectNodeTree(figma, args.to, '', 0, maxDepth)
    const allPaths = new Set([...fromNodes.keys(), ...toNodes.keys()])

    const patches: string[] = []
    for (const path of allPaths) {
      const fromEntry = fromNodes.get(path)
      const toEntry = toNodes.get(path)

      if (!fromEntry && toEntry) {
        const filename = `${path} #${toEntry.id}`
        const newLines = toEntry.serialized.split('\n')
        patches.push(
          `--- /dev/null\n+++ ${filename}\n@@ -0,0 +1,${newLines.length} @@\n${newLines.map((l) => `+${l}`).join('\n')}`
        )
      } else if (fromEntry && !toEntry) {
        const filename = `${path} #${fromEntry.id}`
        const oldLines = fromEntry.serialized.split('\n')
        patches.push(
          `--- ${filename}\n+++ /dev/null\n@@ -1,${oldLines.length} +0,0 @@\n${oldLines.map((l) => `-${l}`).join('\n')}`
        )
      } else if (fromEntry && toEntry && fromEntry.serialized !== toEntry.serialized) {
        patches.push(
          createUnifiedDiff(
            `${path} #${fromEntry.id}`,
            `${path} #${toEntry.id}`,
            fromEntry.serialized,
            toEntry.serialized
          )
        )
      }
    }

    if (patches.length === 0) return { diff: null, message: 'No differences found' }
    return { diff: patches.join('\n') }
  }
})

export const diffShow = defineTool({
  name: 'diff_show',
  description:
    'Preview what would change if properties were applied to a node. Shows a unified diff of current vs proposed state.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    props: {
      type: 'string',
      description:
        'JSON object of new properties, e.g. \'{"opacity": 1, "fill": "#FF0000", "width": 200}\'',
      required: true
    }
  },
  execute: (figma, args) => {
    const raw = figma.graph.getNode(args.id)
    if (!raw) return { error: `Node "${args.id}" not found` }

    const oldContent = serializeNodeProps(raw)

    let newProps: Record<string, unknown>
    try {
      newProps = JSON.parse(args.props)
    } catch {
      return { error: 'Invalid JSON in props' }
    }

    const modified: SceneNode = structuredClone(raw)
    if (newProps.fill) {
      modified.fills = [
        { type: 'SOLID', color: parseColor(String(newProps.fill)), opacity: 1, visible: true }
      ]
    }
    if (newProps.stroke) {
      modified.strokes = [
        {
          color: parseColor(String(newProps.stroke)),
          weight: modified.strokes[0]?.weight ?? 1,
          opacity: 1,
          visible: true,
          align: modified.strokes[0]?.align ?? 'INSIDE'
        }
      ]
    }
    if (newProps.opacity !== undefined) modified.opacity = Number(newProps.opacity)
    if (newProps.radius !== undefined) {
      const r = Number(newProps.radius)
      modified.cornerRadius = r
      modified.topLeftRadius = r
      modified.topRightRadius = r
      modified.bottomRightRadius = r
      modified.bottomLeftRadius = r
    }
    if (newProps.width !== undefined) modified.width = Number(newProps.width)
    if (newProps.height !== undefined) modified.height = Number(newProps.height)
    if (newProps.x !== undefined) modified.x = Number(newProps.x)
    if (newProps.y !== undefined) modified.y = Number(newProps.y)
    if (newProps.visible !== undefined) modified.visible = Boolean(newProps.visible)
    if (newProps.locked !== undefined) modified.locked = Boolean(newProps.locked)
    if (newProps.rotation !== undefined) modified.rotation = Number(newProps.rotation)
    if (newProps.text !== undefined) modified.text = String(newProps.text)

    const newContent = serializeNodeProps(modified)

    if (oldContent === newContent) return { diff: null, message: 'No changes' }

    const filename = `/${raw.name} #${args.id}`
    return { diff: createUnifiedDiff(filename, filename, oldContent, newContent) }
  }
})

// ─── Eval escape hatch ────────────────────────────────────────

export const evalCode = defineTool({
  name: 'eval',
  description:
    'Execute JavaScript with full Figma Plugin API access. Use for operations not covered by other tools. The `figma` global is available.',
  params: {
    code: { type: 'string', description: 'JavaScript code to execute', required: true }
  },
  execute: async (figma, { code }) => {
    // eslint-disable-next-line no-empty-function
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const wrapped = code.trim().startsWith('return') ? code : `return (async () => { ${code} })()`
    const fn = new AsyncFunction('figma', wrapped)
    const result = await fn(figma)
    if (result && typeof result === 'object' && 'toJSON' in result) return result.toJSON()
    return result ?? null
  }
})
