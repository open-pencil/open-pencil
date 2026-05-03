import { sceneNodeToJSX } from '#core/io/formats/jsx'
import { defineTool } from '#core/tools/schema'
import { createTwoFilesPatch } from 'diff'

const MAX_JSX_LENGTH = 12_000

export const getJsx = defineTool({
  name: 'get_jsx',
  description:
    'Get JSX representation of a node and its children. Compact round-trip format — same syntax as the render tool.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    path: {
      type: 'string',
      description: 'Write JSX to this path instead of returning it (requires OPENPENCIL_MCP_ROOT)'
    }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const jsx = sceneNodeToJSX(id, figma.graph)
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

export const diffJsx = defineTool({
  name: 'diff_jsx',
  description:
    'Structural diff between two nodes in JSX format. Shows added/removed children, changed props.',
  params: {
    from: { type: 'string', description: 'Source node ID', required: true },
    to: { type: 'string', description: 'Target node ID', required: true }
  },
  execute: (figma, { from, to }) => {
    const fromNode = figma.getNodeById(from)
    if (!fromNode) return { error: `Node "${from}" not found` }
    const toNode = figma.getNodeById(to)
    if (!toNode) return { error: `Node "${to}" not found` }

    const fromJsx = sceneNodeToJSX(from, figma.graph)
    const toJsx = sceneNodeToJSX(to, figma.graph)

    if (fromJsx === toJsx) return { diff: null, message: 'No differences' }

    const patch = createTwoFilesPatch(
      fromNode.name,
      toNode.name,
      fromJsx,
      toJsx,
      'source',
      'target',
      { context: 3 }
    )
    return { diff: patch }
  }
})
