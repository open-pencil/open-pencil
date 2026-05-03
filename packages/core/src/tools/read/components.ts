import { defineTool } from '#core/tools/schema'

export const getComponents = defineTool({
  name: 'get_components',
  description: 'List all components in the document, optionally filtered by name.',
  params: {
    name: { type: 'string', description: 'Filter by name (case-insensitive substring)' },
    limit: { type: 'number', description: 'Max results (default: 50)' }
  },
  execute: (figma, args) => {
    const limit = args.limit ?? 50
    const nameFilter = args.name?.toLowerCase()
    const components: { id: string; name: string; type: string; page: string }[] = []

    for (const page of figma.root.children) {
      if (components.length >= limit) break
      page.findAll((node) => {
        if (components.length >= limit) return false
        if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') return false
        if (nameFilter && !node.name.toLowerCase().includes(nameFilter)) return false
        components.push({ id: node.id, name: node.name, type: node.type, page: page.name })
        return false
      })
    }

    return { count: components.length, components }
  }
})
