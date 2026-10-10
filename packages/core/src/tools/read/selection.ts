import * as v from 'valibot'

import type { FigmaNodeProxy } from '#core/figma-api'
import { toolNumber } from '#core/tools/input'
import { defineTool, nodeToResult } from '#core/tools/schema'

/** How far `get_selection` describes the selection's children unless asked for more. */
const SELECTION_DEPTH = 1

export const getSelection = defineTool({
  name: 'get_selection',
  description:
    'Get the selected nodes: the place to start when the user points at layers. Returns each selected node with its direct children by default; children past the depth are counted as childCount. Use get_node or describe for deeper branches.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.strictObject({
    depth: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.integer(),
          v.minValue(0),
          v.description(
            `Levels of children to include (0 = selected nodes only). Default: ${SELECTION_DEPTH}`
          )
        )
      )
    )
  }),
  execute: (figma, { depth = SELECTION_DEPTH }) => {
    const selection = figma.currentPage.selection
    return { selection: selection.map((node) => nodeToResult(node, depth)) }
  }
})

export const selectNodes = defineTool({
  name: 'select_nodes',

  description: 'Select one or more nodes by ID.',
  execution: { kind: 'sync', mutation: 'view' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(1), v.description('Node IDs to select'))
  }),
  execute: (figma, { ids }) => {
    figma.currentPage.selection = ids
      .map((id) => figma.getNodeById(id))
      .filter((node): node is FigmaNodeProxy => node !== null)
    return { selected: ids }
  }
})
