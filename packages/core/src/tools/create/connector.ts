import * as v from 'valibot'

import { toolNumber } from '#core/tools/input'
import { defineTool, nodeSummary } from '#core/tools/schema'

const MAGNETS = ['AUTO', 'TOP', 'RIGHT', 'BOTTOM', 'LEFT', 'CENTER'] as const
const CAPS = [
  'NONE',
  'ARROW_LINES',
  'ARROW_EQUILATERAL',
  'TRIANGLE_FILLED',
  'DIAMOND_FILLED',
  'CIRCLE_FILLED'
] as const

const endInput = (label: string) =>
  v.optional(
    v.strictObject({
      id: v.optional(v.pipe(v.string(), v.description(`Node ID the ${label} attaches to`))),
      magnet: v.optional(
        v.pipe(
          v.picklist(MAGNETS),
          v.description('Side it attaches by; AUTO picks the nearest. Straight lines use CENTER')
        )
      ),
      x: v.optional(toolNumber(v.pipe(v.number(), v.description('Page X of a free end')))),
      y: v.optional(toolNumber(v.pipe(v.number(), v.description('Page Y of a free end'))))
    }),
    {}
  )

export const createConnectorTool = defineTool({
  name: 'create_connector',

  description:
    'Create a FigJam-style connector between two layers, or from or to a point on the page. A connector follows the layers it joins as they move and is deleted with them. Give each end a node id (and optionally a magnet side), or x/y for a free end.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    start: endInput('start'),
    end: endInput('end'),
    line_type: v.optional(
      v.pipe(v.picklist(['ELBOWED', 'STRAIGHT', 'CURVED']), v.description('Path shape'))
    ),
    start_cap: v.optional(v.pipe(v.picklist(CAPS), v.description('Cap at the start'))),
    end_cap: v.optional(
      v.pipe(v.picklist(CAPS), v.description('Cap at the end; an arrow by default'))
    ),
    label: v.optional(v.pipe(v.string(), v.description('Text on the line'))),
    name: v.optional(v.pipe(v.string(), v.description('Layer name')))
  }),
  execute: (figma, args) => {
    const connector = figma.createConnector()
    const straight = args.line_type === 'STRAIGHT'
    if (args.line_type) connector.connectorLineType = args.line_type
    const endpoint = (end: typeof args.start) => {
      if (end.id) {
        return { endpointNodeId: end.id, magnet: end.magnet ?? (straight ? 'CENTER' : 'AUTO') }
      }
      return { position: { x: end.x ?? 0, y: end.y ?? 0 } }
    }
    connector.connectorStart = endpoint(args.start)
    connector.connectorEnd = endpoint(args.end)
    if (args.start_cap) connector.connectorStartStrokeCap = args.start_cap
    if (args.end_cap) connector.connectorEndStrokeCap = args.end_cap
    if (args.label) connector.text.characters = args.label
    if (args.name) connector.name = args.name
    return nodeSummary(connector)
  }
})
