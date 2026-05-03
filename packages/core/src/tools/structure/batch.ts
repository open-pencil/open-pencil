import { defineTool } from '#core/tools/schema'

import type { FigmaNodeProxy } from '#core/figma-api'

interface BatchOp {
  id: string
  props: Record<string, unknown>
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

function applyBatchProps(node: FigmaNodeProxy, props: Record<string, unknown>): string[] {
  const updated: string[] = []

  if (props.spacing !== undefined) {
    node.itemSpacing = num(props.spacing)
    updated.push('spacing')
  }
  if (props.padding !== undefined) {
    const value = num(props.padding)
    node.paddingTop = value
    node.paddingRight = value
    node.paddingBottom = value
    node.paddingLeft = value
    updated.push('padding')
  }
  if (props.padding_horizontal !== undefined) {
    node.paddingLeft = num(props.padding_horizontal)
    node.paddingRight = num(props.padding_horizontal)
    updated.push('padding_horizontal')
  }
  if (props.padding_vertical !== undefined) {
    node.paddingTop = num(props.padding_vertical)
    node.paddingBottom = num(props.padding_vertical)
    updated.push('padding_vertical')
  }
  if (props.counter_align !== undefined) {
    node.counterAxisAlignItems = str(props.counter_align)
    updated.push('counter_align')
  }
  if (props.align !== undefined) {
    node.primaryAxisAlignItems = str(props.align)
    updated.push('align')
  }
  if (props.sizing_horizontal !== undefined) {
    node.layoutSizingHorizontal = str(props.sizing_horizontal)
    updated.push('sizing_horizontal')
  }
  if (props.sizing_vertical !== undefined) {
    node.layoutSizingVertical = str(props.sizing_vertical)
    updated.push('sizing_vertical')
  }
  if (props.grow !== undefined) {
    node.layoutGrow = num(props.grow)
    updated.push('grow')
  }
  if (props.name !== undefined) {
    node.name = str(props.name)
    updated.push('name')
  }
  if (props.visible !== undefined) {
    node.visible = Boolean(props.visible)
    updated.push('visible')
  }
  if (props.corner_radius !== undefined) {
    node.cornerRadius = num(props.corner_radius)
    updated.push('corner_radius')
  }
  if (props.opacity !== undefined) {
    node.opacity = num(props.opacity)
    updated.push('opacity')
  }
  if (props.auto_resize !== undefined) {
    node.textAutoResize = str(props.auto_resize)
    updated.push('auto_resize')
  }
  if (props.direction !== undefined) {
    node.layoutMode = str(props.direction) as 'HORIZONTAL' | 'VERTICAL'
    updated.push('direction')
  }

  return updated
}

export const batchUpdate = defineTool({
  name: 'batch_update',
  mutates: true,
  description:
    'Execute multiple modifications in one call. Each operation is {id, props} where props can include: spacing, padding, padding_horizontal, padding_vertical, counter_align, sizing_horizontal, sizing_vertical, grow, name, visible, corner_radius, auto_resize (for text), direction. Runs all updates with one layout recompute.',
  params: {
    operations: {
      type: 'string',
      description:
        'JSON array: [{"id":"0:5","props":{"spacing":8}},{"id":"0:6","props":{"sizing_horizontal":"FILL","grow":1}}]',
      required: true
    }
  },
  execute: (figma, { operations }) => {
    let ops: BatchOp[]
    try {
      ops = JSON.parse(String(operations))
    } catch {
      return { error: 'Invalid JSON in operations' }
    }
    if (!Array.isArray(ops)) return { error: 'operations must be a JSON array' }

    const results: Array<{ id: string; updated: string[] }> = []
    const errors: string[] = []

    for (const op of ops) {
      const node = figma.getNodeById(op.id)
      if (!node) {
        errors.push(`Node "${op.id}" not found`)
        continue
      }
      const updated = applyBatchProps(node, op.props)
      if (updated.length > 0) results.push({ id: op.id, updated })
    }

    const out: Record<string, unknown> = { updated: results.length }
    if (results.length > 0) out.results = results
    if (errors.length > 0) out.errors = errors
    return out
  }
})
