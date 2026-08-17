import { getComponentCatalog } from '#core/tools/component-catalog'
import { defineTool } from '#core/tools/schema'

interface DocumentComponentResult {
  id: string
  name: string
  type: string
  page: string
  source: 'document'
}

interface LibraryComponentResult {
  libraryId: string
  libraryName: string
  revisionId: string
  assetKey: string
  name: string
  type: string
  description: string
  source: 'library'
  enabled: boolean
  priority: number
}

export const getComponents = defineTool({
  name: 'get_components',
  description:
    'List reusable components from the document and enabled component libraries, optionally filtered by name.',
  params: {
    name: { type: 'string', description: 'Filter by name (case-insensitive substring)' },
    source: {
      type: 'string',
      description: 'Component source',
      enum: ['all', 'document', 'libraries'],
      default: 'all'
    },
    library_id: { type: 'string', description: 'Filter library components by library ID' },
    limit: { type: 'number', description: 'Max results (default: 50)' }
  },
  execute: async (figma, args) => {
    const limit = args.limit ?? 50
    const source = args.source ?? 'all'
    const nameFilter = args.name?.toLowerCase()
    const documentComponents: DocumentComponentResult[] = []

    if (source !== 'libraries') {
      for (const page of figma.root.children) {
        if (documentComponents.length >= limit) break
        page.findAll((node) => {
          if (documentComponents.length >= limit) return false
          if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') return false
          if (nameFilter && !node.name.toLowerCase().includes(nameFilter)) return false
          documentComponents.push({
            id: node.id,
            name: node.name,
            type: node.type,
            page: page.name,
            source: 'document'
          })
          return false
        })
      }
    }

    const catalog = getComponentCatalog(figma.graph)
    const libraryComponents: LibraryComponentResult[] = []
    if (source !== 'document' && catalog) {
      const assets = await catalog.listComponents({
        name: args.name,
        libraryId: args.library_id,
        enabledOnly: true
      })
      libraryComponents.push(
        ...assets.map(({ libraryId, libraryName, revisionId, enabled, priority, asset }) => ({
          libraryId,
          libraryName,
          revisionId,
          assetKey: asset.key,
          name: asset.name,
          type: asset.type,
          description: asset.description,
          source: 'library' as const,
          enabled,
          priority
        }))
      )
    }

    const components = [...libraryComponents, ...documentComponents]
      .sort((left, right) => {
        const leftPriority = 'priority' in left ? left.priority : -1
        const rightPriority = 'priority' in right ? right.priority : -1
        return rightPriority - leftPriority || left.name.localeCompare(right.name)
      })
      .slice(0, limit)
    return { count: components.length, components }
  }
})
