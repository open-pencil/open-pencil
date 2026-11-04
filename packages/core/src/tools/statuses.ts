import * as v from 'valibot'

import { STATUS_NODE_TYPES } from '@open-pencil/scene-graph/statuses'

import { OpenPencilAPI } from '#core/openpencil-api'
import { defineTool, toolFailure } from '#core/tools/schema'

export const getStatuses = defineTool({
  name: 'get_statuses',
  description:
    'Read the document’s statuses, such as Draft, In review or Ready for dev, and the layers ' +
    'that show one: sections, frames, components and instances, with their page. Use it to ' +
    'find what is ready to build or still in review, and set_status to change one.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    status: v.optional(v.pipe(v.string(), v.description('Only layers with this status name')))
  }),
  execute: (figma, { status }) => {
    const api = new OpenPencilAPI(figma)
    const { graph } = figma
    const layers = [...graph.getAllNodes()].flatMap((node) => {
      if (!STATUS_NODE_TYPES.has(node.type) || !node.status) return []
      const name = api.getStatus(node.id)
      if (!name || (status !== undefined && name !== status)) return []
      const page = graph.getNode(graph.pageOf(node.id) ?? '')
      return [{ id: node.id, name: node.name, type: node.type, page: page?.name, status: name }]
    })
    return { statuses: api.statuses, layers }
  }
})

export const setStatus = defineTool({
  name: 'set_status',
  description:
    'Give a section, frame, component or instance one of the document’s statuses by name, as ' +
    'get_statuses lists them, or clear its status with null. Only layers directly on a page or ' +
    'in a section take one.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    node: v.pipe(v.string(), v.description('Layer ID')),
    status: v.pipe(
      v.nullable(v.string()),
      v.description('A status name from get_statuses, or null to clear it')
    )
  }),
  execute: (figma, { node, status }) => {
    try {
      const api = new OpenPencilAPI(figma)
      api.setStatus(node, status)
      return { node, status: api.getStatus(node) }
    } catch (error) {
      return toolFailure(error)
    }
  }
})
