import { defineTool } from '#core/tools/schema'

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

