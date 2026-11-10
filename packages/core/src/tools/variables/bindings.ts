import * as v from 'valibot'

import type { FigmaAPI } from '#core/figma-api'
import { graphOf } from '#core/figma-api/graph'
import { OpenPencilAPI } from '#core/openpencil-api'
import { nodeIdInputSchema, defineTool } from '#core/tools/schema'

function unbind(figma: FigmaAPI, nodeId: string, field: string) {
  const node = graphOf(figma).getNode(nodeId)
  if (!node) return { error: `Node "${nodeId}" not found` }
  if (!node.boundVariables[field])
    return { error: `No binding found for field "${field}" on node "${nodeId}"` }
  new OpenPencilAPI(figma).unbindVariable(nodeId, field)
  return { unbound: true, node_id: nodeId, field }
}

export const bindVariable = defineTool({
  name: 'bind_variable',

  description: 'Bind a variable to a node property, or unbind it with a null variable_id.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    node_id: nodeIdInputSchema,
    field: v.pipe(
      v.string(),
      v.description(
        'Field path. COLOR: "fills/0/color", "strokes/0/color", "effects/0/color". ' +
          'FLOAT: opacity, width, height, x, y, rotation, cornerRadius, topLeftRadius, topRightRadius, bottomLeftRadius, bottomRightRadius, ' +
          'fontSize, letterSpacing, lineHeight, itemSpacing, counterAxisSpacing, paddingLeft/Right/Top/Bottom, strokeWeight, ' +
          'borderTopWeight, borderBottomWeight, borderLeftWeight, borderRightWeight, minWidth, maxWidth, minHeight, maxHeight, gridRowGap, gridColumnGap, ' +
          '"effects/0/radius", "effects/0/spread", "effects/0/offsetX", "effects/0/offsetY" (a blur binds only radius). ' +
          'STRING: fontFamily. STRING or FLOAT: text, a number shown as text. BOOLEAN or STRING: visible, where text shows the layer unless empty, "false", "no", or "off".'
      )
    ),
    variable_id: v.pipe(v.nullable(v.string()), v.description('Variable ID, or null to unbind'))
  }),
  execute: (figma, args) => {
    const node = figma.getNodeById(args.node_id)
    if (!node) return { error: `Node "${args.node_id}" not found` }
    if (args.variable_id === null) return unbind(figma, args.node_id, args.field)
    const variable = figma.variables.getVariableById(args.variable_id)
    if (!variable) return { error: `Variable "${args.variable_id}" not found` }
    try {
      new OpenPencilAPI(figma).bindVariable(args.node_id, args.field, variable)
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
    return { node_id: args.node_id, field: args.field, variable_id: args.variable_id }
  }
})
