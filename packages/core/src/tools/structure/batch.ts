import * as v from 'valibot'

import type { FigmaNodeProxy } from '#core/figma-api'
import { textFonts } from '#core/tools/modify/text'
import { defineTool, nodeNotFound, toolNumber } from '#core/tools/schema'

const nonNegative = () => toolNumber(v.pipe(v.number(), v.minValue(0)))

/** Every prop an operation may set; anything else rejects the whole batch. */
const batchPropsSchema = v.strictObject({
  spacing: v.optional(nonNegative()),
  padding: v.optional(nonNegative()),
  padding_horizontal: v.optional(nonNegative()),
  padding_vertical: v.optional(nonNegative()),
  align: v.optional(v.picklist(['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'])),
  counter_align: v.optional(v.picklist(['MIN', 'CENTER', 'MAX', 'STRETCH'])),
  sizing_horizontal: v.optional(v.picklist(['FIXED', 'HUG', 'FILL'])),
  sizing_vertical: v.optional(v.picklist(['FIXED', 'HUG', 'FILL'])),
  grow: v.optional(nonNegative()),
  name: v.optional(v.string()),
  visible: v.optional(v.boolean()),
  corner_radius: v.optional(nonNegative()),
  opacity: v.optional(toolNumber(v.pipe(v.number(), v.minValue(0), v.maxValue(1)))),
  auto_resize: v.optional(v.picklist(['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE'])),
  direction: v.optional(v.picklist(['HORIZONTAL', 'VERTICAL']))
})
type BatchProps = v.InferOutput<typeof batchPropsSchema>

const batchOpsSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.array(v.strictObject({ id: v.string(), props: batchPropsSchema }))
)
type BatchOp = v.InferOutput<typeof batchOpsSchema>[number]

/** The operations a call names, or every problem with them. */
function parseOperations(operations: string): BatchOp[] | { error: string } {
  const result = v.safeParse(batchOpsSchema, operations)
  if (result.success) return result.output
  return { error: `Invalid operations:\n${v.summarize(result.issues)}` }
}

function applyBatchProps(node: FigmaNodeProxy, props: BatchProps): void {
  if (props.spacing !== undefined) node.itemSpacing = props.spacing
  if (props.padding !== undefined) {
    node.paddingTop = props.padding
    node.paddingRight = props.padding
    node.paddingBottom = props.padding
    node.paddingLeft = props.padding
  }
  if (props.padding_horizontal !== undefined) {
    node.paddingLeft = props.padding_horizontal
    node.paddingRight = props.padding_horizontal
  }
  if (props.padding_vertical !== undefined) {
    node.paddingTop = props.padding_vertical
    node.paddingBottom = props.padding_vertical
  }
  if (props.align !== undefined) node.primaryAxisAlignItems = props.align
  if (props.counter_align !== undefined) node.counterAxisAlignItems = props.counter_align
  if (props.sizing_horizontal !== undefined) node.layoutSizingHorizontal = props.sizing_horizontal
  if (props.sizing_vertical !== undefined) node.layoutSizingVertical = props.sizing_vertical
  if (props.grow !== undefined) node.layoutGrow = props.grow
  if (props.name !== undefined) node.name = props.name
  if (props.visible !== undefined) node.visible = props.visible
  if (props.corner_radius !== undefined) node.cornerRadius = props.corner_radius
  if (props.opacity !== undefined) node.opacity = props.opacity
  if (props.auto_resize !== undefined) node.textAutoResize = props.auto_resize
  if (props.direction !== undefined) node.layoutMode = props.direction
}

export const batchUpdate = defineTool({
  name: 'batch_update',

  description:
    'Execute multiple modifications in one call, all or nothing: if any operation names a missing node or an invalid prop, nothing changes. ' +
    `Each operation is {id, props} where props can include: ${Object.keys(batchPropsSchema.entries).join(', ')}. ` +
    'Runs all updates with one layout recompute.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    operations: v.pipe(
      v.string(),
      v.description(
        'JSON array: [{"id":"0:5","props":{"spacing":8}},{"id":"0:6","props":{"sizing_horizontal":"FILL","grow":1}}]'
      )
    )
  }),
  // Text that resizes itself lays out again, so its fonts load first.
  fonts: (figma, { operations }) => {
    const ops = parseOperations(operations)
    if (!Array.isArray(ops)) return []
    return ops.flatMap((op) => (op.props.auto_resize === undefined ? [] : textFonts(figma, op.id)))
  },
  execute: (figma, { operations }) => {
    const ops = parseOperations(operations)
    if (!Array.isArray(ops)) return ops

    // Find every layer before writing, so a missing one leaves the document untouched.
    const targets: Array<{ node: FigmaNodeProxy; props: BatchProps }> = []
    for (const op of ops) {
      const node = figma.getNodeById(op.id)
      if (!node) return nodeNotFound(op.id)
      targets.push({ node, props: op.props })
    }

    const results: Array<{ id: string; updated: string[] }> = []
    for (const { node, props } of targets) {
      applyBatchProps(node, props)
      const updated = Object.keys(props)
      if (updated.length > 0) results.push({ id: node.id, updated })
    }

    const out: Record<string, unknown> = { updated: results.length }
    if (results.length > 0) out.results = results
    return out
  }
})
