import * as v from 'valibot'

import { graphOf } from '#core/figma-api/graph'
import { arrangeLayers } from '#core/layout/arrange/layers'
import { toolNumber, defineTool } from '#core/tools/schema'

export const arrangeNodes = defineTool({
  name: 'arrange',

  description: `Arrange layers so they stop overlapping or follow a structure. Modes:
- spread (default): push overlapping layers apart, each staying near where it was.
- compact: spread, then close the gaps.
- pack: rows in order, like a page of screens or components.
- grid, row, column: in order from the first layer; grid takes cols.
- flow: ranks along connectors, rerouting elbowed ones; flowcharts, pipelines, state machines.
- tree: from its roots along connectors; sitemaps, org charts.
- radial: a tree in rings; mind maps.
- network: joined layers near each other; relationship maps.
Connectors between the layers are found automatically. A section given with all its children is laid out inside; a section alone moves as one box. Layers outside chosen sections must share a parent. The top-left corner stays put.`,
  execution: { kind: 'async', mutation: 'document' },
  input: v.strictObject({
    ids: v.optional(
      v.pipe(
        v.array(v.string()),
        v.minLength(1),
        v.description('Layer IDs to arrange (default: every top-level layer on the current page)')
      )
    ),
    mode: v.optional(
      v.pipe(
        v.picklist([
          'spread',
          'compact',
          'pack',
          'grid',
          'row',
          'column',
          'flow',
          'tree',
          'radial',
          'network'
        ]),
        v.description('How to arrange them (default: spread)')
      ),
      'spread'
    ),
    direction: v.optional(
      v.pipe(
        v.picklist(['TB', 'BT', 'LR', 'RL']),
        v.description(
          'Direction of a flow or tree: top to bottom (default), bottom to top, left to right, right to left'
        )
      )
    ),
    gap: v.optional(
      toolNumber(
        v.pipe(v.number(), v.minValue(0), v.description('Spacing between layers (default: 40)'))
      )
    ),
    cols: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.integer(),
          v.minValue(1),
          v.description('Column count for grid mode (default: auto)')
        )
      )
    )
  }),
  execute: async (figma, args) => {
    const ids = args.ids ?? figma.currentPage.children.map((node) => node.id)
    if (ids.length === 0) return { error: 'No layers to arrange' }
    try {
      const arranged = await arrangeLayers(graphOf(figma), ids, {
        layout: args.mode,
        direction: args.direction,
        spacing: args.gap,
        columns: args.cols
      })
      return { mode: args.mode, ...arranged }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
})
