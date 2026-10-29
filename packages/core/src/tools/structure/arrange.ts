import * as v from 'valibot'

import { arrangeLayers } from '#core/layout/arrange/layers'
import { toolNumber, defineTool } from '#core/tools/schema'

export const arrangeNodes = defineTool({
  name: 'arrange',

  description: `Arrange layers so they stop overlapping or follow a structure. Modes:
- spread (default): push overlapping layers apart, keeping each near where it was. Use it after creating layers that landed on each other.
- compact: spread, then close the gaps, keeping the layers' relative places.
- pack: pack the layers into rows in their order, as tidy as a page of screens or components.
- grid, row, column: place them in a grid (cols), a row, or a column, in order, from the first layer.
- flow: rank them along the connectors joining them, rerouting elbowed connectors with right-angled bends; for flowcharts, pipelines, and state machines.
- tree: a tidy tree from its roots along the connectors; for sitemaps, org charts, and hierarchies.
- radial: a tree in rings around its root; for mind maps.
- network: joined layers near each other with no direction; for relationship maps.
Connectors between the layers are found automatically. Include a section and all its children to lay them out inside it; a section given alone moves as one box. Layers outside chosen sections must share a parent. The arrangement keeps its top-left corner.`,
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
      const arranged = await arrangeLayers(figma.graph, ids, {
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
