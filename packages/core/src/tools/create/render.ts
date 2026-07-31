import { defineTool } from '#core/tools/schema'

export const render = defineTool({
  name: 'render',
  mutates: true,
  description:
    'Render JSX to design nodes. Use replace_id to swap a skeleton placeholder with real content (keeps position in parent). Example: <Frame name="Card" w={320} h="hug" flex="col" gap={16} p={24} bg="#FFF" rounded={16}><Text size={18} weight="bold">Title</Text></Frame>. For arbitrary shapes and outline drawings use <svg> with SVG path data — each <path> becomes its own vector node, and open paths stroke correctly: <svg name="Boat" viewBox="0 0 640 700" size={600}><path d="M380 40 L380 560" stroke="#021A3B" stroke-width="6" fill="none" /><path d="M100 560 C175 695 585 695 660 560 Z" stroke="#021A3B" stroke-width="6" fill="none" /></svg>',
  params: {
    replace_id: {
      type: 'string',
      description: 'Node ID to replace — new node takes its position in parent, old node is deleted'
    },
    parent_id: { type: 'string', description: 'Parent node ID to render into' },
    insert_index: {
      type: 'number',
      description: 'Position among siblings (0 = first child). Omit to append at end.'
    },
    x: { type: 'number', description: 'X position of the root node' },
    y: { type: 'number', description: 'Y position of the root node' },
    jsx: { type: 'string', description: 'JSX string to render', required: true }
  },
  execute: async (figma, args) => {
    const { renderJSX } = await import('#core/design-jsx/render.js')

    let parentId = args.parent_id ?? figma.currentPageId
    let replaceIndex = -1

    if (args.replace_id) {
      const target = figma.graph.getNode(args.replace_id)
      if (target?.parentId) {
        parentId = target.parentId
        const parent = figma.graph.getNode(parentId)
        if (parent) {
          replaceIndex = parent.childIds.indexOf(args.replace_id)
        }
      }
    }

    const results = await renderJSX(figma.graph, args.jsx, {
      parentId,
      x: args.x,
      y: args.y
    })
    const result = results[0]

    if (args.replace_id && replaceIndex >= 0) {
      figma.graph.reorderChild(result.id, parentId, replaceIndex)
      figma.graph.deleteNode(args.replace_id)
    } else if (args.insert_index !== undefined) {
      figma.graph.reorderChild(result.id, parentId, args.insert_index)
    }

    return {
      id: result.id,
      name: result.name,
      type: result.type,
      children: result.childIds,
      ...(result.warnings ? { warnings: result.warnings } : {}),
      ...(results.length > 1
        ? {
            siblings: results
              .slice(1)
              .map((node) => ({ id: node.id, name: node.name, type: node.type }))
          }
        : {})
    }
  }
})
