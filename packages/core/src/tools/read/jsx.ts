import * as v from 'valibot'

import { sceneNodeToJSX } from '@open-pencil/design-jsx'

import { graphOf } from '#core/figma-api/graph'
import { jsxPatch } from '#core/tools/analyze/diff/jsx'
import { nodeIdInputSchema, nodeComparisonInputSchema, defineTool } from '#core/tools/schema'

const MAX_JSX_LENGTH = 12_000

export const getJSX = defineTool({
  name: 'get_jsx',
  description:
    'Get JSX representation of a node and its children. Compact round-trip format — same syntax as the render tool.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    id: nodeIdInputSchema,
    path: v.optional(
      v.pipe(
        v.string(),
        v.description(
          'Write JSX to this path instead of returning it (requires OPENPENCIL_MCP_ROOT)'
        )
      )
    )
  }),
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const jsx = sceneNodeToJSX(id, graphOf(figma))
    if (jsx.length > MAX_JSX_LENGTH) {
      return {
        id,
        name: node.name,
        jsx: jsx.slice(0, MAX_JSX_LENGTH),
        truncated: true,
        totalLength: jsx.length
      }
    }
    return { id, name: node.name, jsx }
  }
})

export const diffJSX = defineTool({
  name: 'diff_jsx',
  description:
    'Structural diff between two nodes in JSX format. Shows added/removed children, changed props.',
  execution: { kind: 'sync', mutation: 'none' },
  // Kept for `open-pencil diff jsx`; agents get diff_create, which also gives an appliable patch.
  exposure: { mcp: false, ai: false, webmcp: false },
  input: nodeComparisonInputSchema,
  execute: (figma, { from, to }) => {
    const fromNode = figma.getNodeById(from)
    if (!fromNode) return { error: `Node "${from}" not found` }
    const toNode = figma.getNodeById(to)
    if (!toNode) return { error: `Node "${to}" not found` }

    const patch = jsxPatch(
      fromNode.name,
      toNode.name,
      sceneNodeToJSX(from, graphOf(figma)),
      sceneNodeToJSX(to, graphOf(figma))
    )
    return patch === null ? { diff: null, message: 'No differences' } : { diff: patch }
  }
})
