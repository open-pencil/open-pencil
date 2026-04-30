import { defineTool } from '#core/tools/schema'

interface SizedItem {
  width: number
  height: number
  childCount: number
}

export function calcClusterConfidence(nodes: SizedItem[]): number {
  if (nodes.length < 2) return 100
  const base = nodes[0]
  let score = 0
  for (const node of nodes.slice(1)) {
    const sizeDiff = Math.abs(node.width - base.width) + Math.abs(node.height - base.height)
    const childDiff = Math.abs(node.childCount - base.childCount)
    if (sizeDiff <= 4 && childDiff === 0) score++
    else if (sizeDiff <= 10 && childDiff <= 1) score += 0.8
    else if (sizeDiff <= 20 && childDiff <= 2) score += 0.6
    else score += 0.4
  }
  return Math.round((score / (nodes.length - 1)) * 100)
}

export const analyzeClusters = defineTool({
  name: 'analyze_clusters',
  description:
    'Find repeated design patterns (potential components). Groups nodes by structural signature — type, size, and child structure.',
  params: {
    min_count: { type: 'number', description: 'Min instances to form a cluster (default: 2)' },
    min_size: { type: 'number', description: 'Min node size in px (default: 30)' },
    limit: { type: 'number', description: 'Max clusters to return (default: 20)' },
  },
  execute: (figma, args) => {
    const minCount = args.min_count ?? 2
    const minSize = args.min_size ?? 30
    const limit = args.limit ?? 20
    const page = figma.currentPage

    const signatureMap = new Map<
      string,
      {
        id: string
        name: string
        type: string
        width: number
        height: number
        childCount: number
      }[]
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

      const width = Math.round(raw.width / 10) * 10
      const height = Math.round(raw.height / 10) * 10
      const childSignature = [...childTypes.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, count]) => `${type}:${count}`)
        .join(',')
      const signature = `${raw.type}:${width}x${height}|${childSignature}`

      const list = signatureMap.get(signature) ?? []
      list.push({
        id: raw.id,
        name: raw.name,
        type: raw.type,
        width: raw.width,
        height: raw.height,
        childCount: raw.childIds.length,
      })
      signatureMap.set(signature, list)
      return false
    })

    const clusters = [...signatureMap.entries()]
      .filter(([, nodes]) => nodes.length >= minCount)
      .map(([signature, nodes]) => {
        const avgWidth = nodes.reduce((sum, node) => sum + node.width, 0) / nodes.length
        const avgHeight = nodes.reduce((sum, node) => sum + node.height, 0) / nodes.length
        const widths = nodes.map((node) => node.width)
        const heights = nodes.map((node) => node.height)
        const widthRange = Math.max(...widths) - Math.min(...widths)
        const heightRange = Math.max(...heights) - Math.min(...heights)
        const confidence = calcClusterConfidence(nodes)

        return {
          signature,
          count: nodes.length,
          avgWidth: Math.round(avgWidth),
          avgHeight: Math.round(avgHeight),
          widthRange: Math.round(widthRange),
          heightRange: Math.round(heightRange),
          confidence,
          examples: nodes.slice(0, 3).map((node) => ({ id: node.id, name: node.name })),
        }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    return { totalNodes, clusters }
  },
})
