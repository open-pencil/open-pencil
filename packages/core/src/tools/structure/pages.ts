import * as v from 'valibot'

import { movePageInGraph } from '#core/editor/pages/move'
import { graphOf } from '#core/figma-api/graph'
import { defineTool, toolNumber } from '#core/tools/schema'

export const movePage = defineTool({
  name: 'move_page',
  description:
    'Move the page identified by target_page_id to a zero-based index. The order is preserved when the file is saved and reopened.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    target_page_id: v.pipe(
      v.string(),
      v.minLength(1),
      v.description('ID of the page to move, from list_pages')
    ),
    index: v.pipe(
      toolNumber(v.number()),
      v.integer(),
      v.minValue(0),
      v.description('Zero-based page index')
    )
  }),
  execute: (figma, { target_page_id, index }) => {
    const graph = graphOf(figma)
    const page = graph.getNode(target_page_id)
    if (page?.type !== 'CANVAS' || page.parentId !== graph.rootId) {
      return { error: `Page "${target_page_id}" not found` }
    }

    const movedIndex = movePageInGraph(graph, target_page_id, index, {
      includeInternal: true
    })
    if (movedIndex === null) return { error: `Page "${target_page_id}" not found` }
    return { id: page.id, name: page.name, index: movedIndex }
  }
})
