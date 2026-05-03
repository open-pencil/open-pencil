import { colorDistance, colorToHex } from '#core/color'
import { defineTool } from '#core/tools/schema'

import type { Color } from '#core/types'

interface ColorEntry {
  hex: string
  color: Color
  count: number
  variableName: string | null
}

function trackColor(colorMap: Map<string, ColorEntry>, color: Color, variableName: string | null) {
  const hex = colorToHex(color)
  const entry = colorMap.get(hex)
  if (entry) {
    entry.count++
    if (!entry.variableName && variableName) entry.variableName = variableName
  } else {
    colorMap.set(hex, { hex, color, count: 1, variableName })
  }
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
          trackColor(
            colorMap,
            stroke.color,
            boundVars['strokes'] ? String(boundVars['strokes']) : null
          )
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
