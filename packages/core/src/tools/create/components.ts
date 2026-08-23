import type { FigmaComponentNode } from '#core/figma-api'
import { defineTool, nodeSummary, requireNodes } from '#core/tools/schema'

export const createComponent = defineTool({
  name: 'create_component',
  mutates: true,
  documentAccess: 'modify',
  description: 'Convert a frame/group into a component.',
  params: {
    id: { type: 'string', description: 'Node ID to convert', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const component = figma.createComponentFromNode(node)
    return nodeSummary(component)
  }
})

export const createInstance = defineTool({
  name: 'create_instance',
  mutates: true,
  documentAccess: 'modify',
  description: 'Create an instance of a component.',
  params: {
    component_id: { type: 'string', description: 'Component node ID', required: true },
    x: { type: 'number', description: 'X position' },
    y: { type: 'number', description: 'Y position' }
  },
  execute: (figma, args) => {
    const component = figma.getNodeById(args.component_id)
    if (!component) return { error: `Component "${args.component_id}" not found` }
    const instance = component.createInstance()
    if (args.x !== undefined) instance.x = args.x
    if (args.y !== undefined) instance.y = args.y
    return nodeSummary(instance)
  }
})

export const combineAsVariants = defineTool({
  name: 'combine_as_variants',
  mutates: true,
  documentAccess: 'modify',
  description:
    'Combine components sharing a parent into a component set (variant set). Components named ' +
    '"Category/Value" (e.g. "Button/Primary") derive variant properties from the name segments.',
  params: {
    ids: { type: 'string[]', description: 'Component node IDs to combine', required: true }
  },
  execute: (figma, { ids }) => {
    const nodes = requireNodes(figma, ids)
    if (!nodes) return { error: 'One or more node IDs were not found' }
    if (nodes.length < 2) return { error: 'Need at least 2 components to combine as variants' }
    if (!nodes.every((node): node is FigmaComponentNode => node.type === 'COMPONENT')) {
      return { error: 'combineAsVariants requires COMPONENT nodes' }
    }
    const parent = nodes[0].parent ?? figma.currentPage
    if (!nodes.every((node) => node.parent?.id === parent.id)) {
      return { error: 'combineAsVariants requires components to share a parent' }
    }
    try {
      const componentSet = figma.combineAsVariants(nodes, parent)
      return nodeSummary(componentSet)
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
})
