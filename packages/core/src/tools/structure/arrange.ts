import { defineTool } from '#core/tools/schema'

import type { FigmaNodeProxy } from '#core/figma-api'

export const arrangeNodes = defineTool({
  name: 'arrange',
  mutates: true,
  description:
    'Arrange top-level nodes on the canvas in a grid, row, or column layout. Useful after batch creation to tidy up overlapping frames.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to arrange (default: all top-level children)' },
    mode: {
      type: 'string',
      description: 'Layout mode',
      enum: ['grid', 'row', 'column'],
      default: 'grid',
    },
    gap: { type: 'number', description: 'Spacing between nodes (default: 40)' },
    cols: { type: 'number', description: 'Column count for grid mode (default: auto)' },
  },
  execute: (figma, args) => {
    const gap = args.gap ?? 40
    const mode = args.mode ?? 'grid'
    const page = figma.currentPage

    let nodes: FigmaNodeProxy[]
    if (args.ids && args.ids.length > 0) {
      nodes = args.ids
        .map((id) => figma.getNodeById(id))
        .filter((node): node is FigmaNodeProxy => node !== null)
    } else {
      nodes = [...page.children]
    }

    if (nodes.length === 0) return { error: 'No nodes to arrange' }
    const first = nodes[0]

    if (mode === 'row') {
      arrangeRow(nodes, first.x, first.y, gap)
    } else if (mode === 'column') {
      arrangeColumn(nodes, first.x, first.y, gap)
    } else {
      arrangeGrid(nodes, first.x, first.y, args.cols ?? Math.ceil(Math.sqrt(nodes.length)), gap)
    }

    return { arranged: nodes.length, mode }
  },
})

function arrangeRow(nodes: FigmaNodeProxy[], startX: number, y: number, gap: number) {
  let x = startX
  for (const node of nodes) {
    node.x = x
    node.y = y
    x += node.width + gap
  }
}

function arrangeColumn(nodes: FigmaNodeProxy[], x: number, startY: number, gap: number) {
  let y = startY
  for (const node of nodes) {
    node.x = x
    node.y = y
    y += node.height + gap
  }
}

function arrangeGrid(nodes: FigmaNodeProxy[], startX: number, startY: number, cols: number, gap: number) {
  let x = startX
  let y = startY
  let rowHeight = 0

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]
    if (index > 0 && index % cols === 0) {
      x = startX
      y += rowHeight + gap
      rowHeight = 0
    }
    node.x = x
    node.y = y
    x += node.width + gap
    rowHeight = Math.max(rowHeight, node.height)
  }
}
