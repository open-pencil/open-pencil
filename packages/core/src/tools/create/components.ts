import type { FigmaNodeProxy } from '#core/figma-api'
import { defineTool, nodeSummary } from '#core/tools/schema'

export const createComponent = defineTool({
  name: 'create_component',
  mutates: true,
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

export const exposeInstanceSwap = defineTool({
  name: 'expose_instance_swap',
  mutates: true,
  description:
    'Expose one or more nested instances as an instance-swap slot, so instances of the enclosing ' +
    'component can pick which component fills it (e.g. an icon slot on a button). All slot instances ' +
    'must live inside the same component or component set.',
  params: {
    instance_ids: {
      type: 'string[]',
      description: 'Instance node IDs to expose as the swap slot (one per variant that has this slot)',
      required: true
    },
    candidate_ids: {
      type: 'string[]',
      description: 'Component node IDs the designer can swap the slot to',
      required: true
    },
    property_name: { type: 'string', description: 'Name for the property (default: "Instance")' }
  },
  execute: (figma, { instance_ids, candidate_ids, property_name }) => {
    const slots = instance_ids.map((id) => figma.getNodeById(id)).filter((n): n is FigmaNodeProxy => n !== null)
    if (slots.length !== instance_ids.length) return { error: 'One or more instance IDs were not found' }
    const candidates = candidate_ids
      .map((id) => figma.getNodeById(id))
      .filter((n): n is FigmaNodeProxy => n !== null)
    if (candidates.length !== candidate_ids.length) return { error: 'One or more candidate IDs were not found' }
    try {
      const host = figma.exposeInstanceSwap(slots, candidates, property_name)
      return nodeSummary(host)
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
})
