import { isEqual } from 'es-toolkit'

import { clampGridPosition, MAX_GRID_LINE, MAX_GRID_SPAN } from '@open-pencil/scene-graph/layout'

import { defineRule } from '#core/lint/rule'

/**
 * A grid item's placement must name whole lines and spans. Yoga aborts the layout engine on a
 * span below one and on a line past its bounds, which leaves every later layout running in a
 * corrupted module, so a document holding one cannot be laid out at all.
 */
export default defineRule({
  meta: {
    id: 'invalid-grid-placement',
    category: 'layout',
    severity: 'error',
    description: 'Grid items are placed on whole lines with spans of at least one track'
  },
  check(node, context) {
    const position = node.gridPosition
    if (!position) return
    const fixed = clampGridPosition(position)
    if (isEqual(fixed, position)) return
    context.report({
      node,
      message: `Grid placement starts at row ${position.row}, column ${position.column} and spans ${position.rowSpan}×${position.columnSpan}; layout places whole lines from 0 to ${MAX_GRID_LINE} with spans from 1 to ${MAX_GRID_SPAN}`,
      suggest: 'Place the item on a whole line, spanning at least one track',
      data: {
        row: position.row,
        column: position.column,
        rowSpan: position.rowSpan,
        columnSpan: position.columnSpan
      },
      fix: { kind: 'set-grid-placement', placement: fixed }
    })
  }
})
