import * as v from 'valibot'

import { sceneNodeToJSX } from '@open-pencil/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { graphOf } from '#core/figma-api/graph'
import { jsxPatch } from '#core/tools/analyze/diff/jsx'
import { nodeIdInputSchema, nodeComparisonInputSchema, defineTool } from '#core/tools/schema'

const MAX_INLINE_JSX_LENGTH = 12_000

/**
 * The JSX of `id` with as many levels of children as fit the inline length, and at least the
 * layer itself; deeper layers are written with `keepChildren`. Only called for JSX over the length,
 * so some depth is always over it and the search ends.
 */
function outlinedJSX(id: string, graph: SceneGraph): { jsx: string; depth: number } {
  let fitting = { jsx: sceneNodeToJSX(id, graph, { maxDepth: 0 }), depth: 0 }
  for (let depth = 1; ; depth++) {
    const jsx = sceneNodeToJSX(id, graph, { maxDepth: depth })
    if (jsx.length > MAX_INLINE_JSX_LENGTH) return fitting
    fitting = { jsx, depth }
  }
}

function outlineNote(id: string, length: number, depth: number): string {
  const over = `The JSX is ${length} characters, over the ${MAX_INLINE_JSX_LENGTH} returned inline`
  const keeps = `Rendering this JSX with replace_id "${id}" keeps the children it leaves out.`
  // Its children alone are too long, so reading it again would give the same outline.
  if (depth === 0) {
    return `${over}, even one level down. List its children with get_node depth 1 and read them with get_jsx. ${keeps}`
  }
  const levels = depth === 1 ? 'level' : 'levels'
  return `${over}, so it is written ${depth} ${levels} deep and the layers there with keepChildren. Read one with get_jsx on the id in its comment. ${keeps}`
}

export const getJSX = defineTool({
  name: 'get_jsx',
  description:
    'Get JSX representation of a node and its children. Compact round-trip format — same syntax as the render tool. ' +
    `JSX longer than ${MAX_INLINE_JSX_LENGTH} characters is outlined: layers below the depth that fits are written ` +
    'with keepChildren and a comment naming their id, to read with get_jsx; render the JSX with replace_id on this node ' +
    'and those layers keep their children.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    id: nodeIdInputSchema,
    path: v.optional(
      v.pipe(
        v.string(),
        v.minLength(1),
        v.description(
          'Write the complete JSX to this path instead of returning it (requires OPENPENCIL_MCP_ROOT)'
        )
      )
    )
  }),
  inputExposure: { path: { ai: false, webmcp: false } },
  execute: (figma, { id, path }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const graph = graphOf(figma)
    const jsx = sceneNodeToJSX(id, graph)
    const writtenToFile = path !== undefined
    // A layer without children has nothing an outline could leave out.
    if (
      writtenToFile ||
      jsx.length <= MAX_INLINE_JSX_LENGTH ||
      graph.getChildren(id).length === 0
    ) {
      return { id, name: node.name, jsx }
    }
    const outline = outlinedJSX(id, graph)
    return {
      id,
      name: node.name,
      jsx: outline.jsx,
      truncated: true,
      depth: outline.depth,
      totalLength: jsx.length,
      note: outlineNote(id, jsx.length, outline.depth)
    }
  }
})

export const diffJSX = defineTool({
  name: 'diff_jsx',
  description:
    'Structural diff between two nodes in JSX format. Shows added/removed children, changed props.',
  execution: { kind: 'sync', mutation: 'none' },
  // Kept for `open-pencil diff jsx`; agents get diff_nodes, which also gives an appliable patch.
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
