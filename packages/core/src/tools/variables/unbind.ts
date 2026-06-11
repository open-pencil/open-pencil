import { defineTool } from '#core/tools/schema'

export const unbindVariable = defineTool({
  name: 'unbind_variable',
  mutates: true,
  description: 'Remove a variable binding from a node property.',
  params: {
    node_id: { type: 'string', description: 'Node ID', required: true },
    field: {
      type: 'string',
      description:
        'Property field path to unbind. For fills/strokes use indexed format: "fills/0/color", "strokes/0/color". ' +
        'For FLOAT scalars: "opacity", "width", "height", "cornerRadius", "fontSize", "letterSpacing", ' +
        '"lineHeight", "itemSpacing", "strokeWeight", "paddingLeft/Right/Top/Bottom", "counterAxisSpacing", ' +
        '"rotation", "x", "y", "minWidth", "maxWidth", "minHeight", "maxHeight", ' +
        '"topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius", ' +
        '"borderTopWeight", "borderBottomWeight", "borderLeftWeight", "borderRightWeight", ' +
        '"gridRowGap", "gridColumnGap". ' +
        'For STRING: "fontFamily". For BOOLEAN: "visible".',
      required: true
    }
  },
  execute: (figma, args) => {
    // Access raw scene node for boundVariables (not exposed on the proxy)
    const rawNode = figma.graph.getNode(args.node_id)
    if (!rawNode) return { error: `Node "${args.node_id}" not found` }
    const boundValue = rawNode.boundVariables[args.field]
    if (!boundValue) {
      return { error: `No binding found for field "${args.field}" on node "${args.node_id}"` }
    }
    figma.unbindVariable(args.node_id, args.field)
    return { unbound: true, node_id: args.node_id, field: args.field }
  }
})
