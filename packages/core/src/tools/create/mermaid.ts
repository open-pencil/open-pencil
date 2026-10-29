import * as v from 'valibot'

import { detectMermaidDiagram, parseFlowchart } from '@open-pencil/mermaid'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'

import { addFlowchart } from '#core/io/formats/mermaid'
import { toolNumber, defineTool } from '#core/tools/schema'

/** Room left between a parent's content and a diagram placed beside it. */
const BESIDE_GAP = 100

export const importMermaid = defineTool({
  name: 'import_mermaid',

  description:
    'Import a Mermaid flowchart (`flowchart` or `graph`) as editable FigJam layers, laid out automatically so nothing overlaps: each node a shape with text in its Mermaid shape, each subgraph a section, and each edge an elbowed connector joined to the layers it links, with its arrowheads, dotted or thick line, and label. classDef, class, and style fills, strokes, and text colours carry over. Without x and y the diagram goes to the right of what the parent already holds. Returns the layer id of every node and subgraph and the connector id of every edge, by Mermaid id.',
  execution: { kind: 'async', mutation: 'document' },
  input: v.strictObject({
    mermaid: v.pipe(
      v.string(),
      v.description('Mermaid flowchart source (e.g. "flowchart LR\\n  A[Start] --> B{Ready?}")')
    ),
    parent_id: v.optional(v.pipe(v.string(), v.description('Parent node ID (default: the page)'))),
    x: v.optional(toolNumber(v.pipe(v.number(), v.description('X of the diagram’s left edge')))),
    y: v.optional(toolNumber(v.pipe(v.number(), v.description('Y of the diagram’s top edge'))))
  }),
  execute: async (figma, args) => {
    if (detectMermaidDiagram(args.mermaid) !== 'flowchart') {
      return {
        error: 'Only Mermaid flowcharts, starting with `flowchart` or `graph`, are supported'
      }
    }
    let chart
    try {
      chart = parseFlowchart(args.mermaid)
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
    const { graph } = figma
    const parentId = args.parent_id ?? figma.currentPage.id
    if (!graph.getNode(parentId)) return { error: `Parent ${parentId} not found` }
    const content = graph.getNode(parentId)?.childIds ?? []
    const bounds =
      content.length > 0
        ? getAxisAlignedBoundsInParent(
            content.flatMap((id) => graph.getNode(id) ?? []),
            parentId,
            graph
          )
        : null
    const topLeft = {
      x: args.x ?? (bounds ? bounds.x + bounds.width + BESIDE_GAP : 0),
      y: args.y ?? bounds?.y ?? 0
    }
    const result = await addFlowchart(graph, parentId, chart, { topLeft })
    return {
      ids: result.ids,
      nodes: Object.fromEntries(result.layers),
      connectors: Object.fromEntries(result.connectors)
    }
  }
})
