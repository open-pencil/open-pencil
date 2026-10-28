import * as v from 'valibot'

import { movePageInGraph } from '#core/editor/pages/move'
import { defineTool, toolNumber } from '#core/tools/schema'

export const movePage = defineTool({
  name: 'move_page',
  description:
    'Move a page to a zero-based index in the document page list. The order is preserved when the file is saved and reopened.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    page_id: v.pipe(v.string(), v.minLength(1), v.description('ID of the page to move')),
    index: v.pipe(
      toolNumber(v.number()),
      v.integer(),
      v.minValue(0),
      v.description('Zero-based page index')
    )
  }),
  execute: (figma, { page_id, index }) => {
    const page = figma.graph.getNode(page_id)
    if (page?.type !== 'CANVAS' || page.parentId !== figma.graph.rootId) {
      return { error: `Page "${page_id}" not found` }
    }

    const movedIndex = movePageInGraph(figma.graph, page_id, index, { includeInternal: true })
    if (movedIndex === null) return { error: `Page "${page_id}" not found` }
    return { id: page.id, name: page.name, index: movedIndex }
  }
})
