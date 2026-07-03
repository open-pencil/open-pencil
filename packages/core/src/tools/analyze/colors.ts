import { orderBy } from 'es-toolkit/array'

import type { Color } from '@open-pencil/scene-graph/primitives'

import { colorDistance, colorToHex } from '#core/color'
import type { ColorUsageEntry } from '#core/color/analysis'
import { defineTool } from '#core/tools/schema'

type ColorEntry = ColorUsageEntry

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
      for (let i = 0; i < raw.fills.length; i++) {
        const fill = raw.fills[i]
        if (fill.type === 'SOLID' && fill.visible) {
          const varId = boundVars[`fills/${i}/color`]
          const variable = varId ? figma.graph.variables.get(varId) : undefined
          trackColor(colorMap, fill.color, variable?.name ?? null)
        }
      }
      for (let i = 0; i < raw.strokes.length; i++) {
        const stroke = raw.strokes[i]
        if (stroke.visible) {
          const varId = boundVars[`strokes/${i}/color`]
          const variable = varId ? figma.graph.variables.get(varId) : undefined
          trackColor(colorMap, stroke.color, variable?.name ?? null)
        }
      }
      return false
    })

    const colors = orderBy([...colorMap.values()], ['count'], ['desc']).slice(0, limit)

    const result: Record<string, unknown> = {
      totalNodes,
      uniqueColors: colorMap.size,
      colors: colors.map((c) => ({ hex: c.hex, count: c.count, variableName: c.variableName }))
    }

    if (args.show_similar) {
      const hardcoded = orderBy(
        [...colorMap.values()].filter((c) => !c.variableName),
        ['count'],
        ['desc']
      )
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

      result.similarClusters = orderBy(clusters, [(cluster) => cluster.colors.length], ['desc'])
    }

    return result
  }
})
