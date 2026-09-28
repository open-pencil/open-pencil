import { orderBy } from 'es-toolkit/array'
import { sumBy } from 'es-toolkit/math'
import * as v from 'valibot'

import { colorDistance, colorToHex } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

import { analysisLimitInput } from './input'

export interface ColorUsageEntry {
  hex: string
  color: Color
  count: number
  variableName: string | null
}

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
  execution: { kind: 'sync', mutation: 'none' },
  input: v.object({
    limit: analysisLimitInput,
    show_similar: v.optional(
      v.pipe(v.boolean(), v.description('Include similar-color clusters for potential merging'))
    ),
    threshold: v.optional(
      toolNumber(
        v.pipe(v.number(), v.description('Distance threshold for clustering (0-50, default: 15)'))
      )
    )
  }),
  execute: (figma, args) => {
    const limit = args.limit
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
            totalCount: sumBy(cluster, (color) => color.count),
            suggestedHex: color.hex
          })
        }
      }

      result.similarClusters = orderBy(clusters, [(cluster) => cluster.colors.length], ['desc'])
    }

    return result
  }
})
