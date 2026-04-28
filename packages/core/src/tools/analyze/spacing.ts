import { defineTool } from '#core/tools/schema'

export const analyzeSpacing = defineTool({
  name: 'analyze_spacing',
  description:
    'Analyze spacing values (gap, padding) across the current page. Checks grid compliance.',
  params: {
    grid: { type: 'number', description: 'Base grid size to check against (default: 8)' },
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

      for (const padding of [raw.paddingTop, raw.paddingRight, raw.paddingBottom, raw.paddingLeft]) {
        if (padding > 0) {
          paddingMap.set(padding, (paddingMap.get(padding) ?? 0) + 1)
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

    const offGridGaps = gaps.filter((gap) => !gap.onGrid)
    const offGridPaddings = paddings.filter((padding) => !padding.onGrid)

    return {
      totalNodes,
      gridSize,
      gaps,
      paddings,
      offGridGaps: offGridGaps.map((gap) => gap.value),
      offGridPaddings: offGridPaddings.map((padding) => padding.value),
    }
  },
})
