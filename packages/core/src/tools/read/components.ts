import * as v from 'valibot'

import type { ComponentPropertyDefinition } from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api'
import { getComponentCatalog } from '#core/tools/component-catalog'
import { toolNumber, defineTool } from '#core/tools/schema'

interface DocumentComponentResult {
  id: string
  name: string
  type: string
  page: string
  source: 'document'
  componentPropertyDefinitions?: ComponentPropertyDefinition[]
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

/** The enabled library components the document's catalog has, matching `name` and `libraryId`. */
async function listLibraryComponents(
  figma: FigmaAPI,
  args: { name?: string; library_id?: string }
): Promise<LibraryComponentResult[]> {
  const catalog = getComponentCatalog(figma.graph)
  if (!catalog) return []
  const assets = await catalog.listComponents({
    name: args.name,
    libraryId: args.library_id,
    enabledOnly: true
  })
  return assets.map(({ libraryId, libraryName, revisionId, enabled, priority, asset }) => ({
    libraryId,
    libraryName,
    revisionId,
    assetKey: asset.key,
    name: asset.name,
    type: asset.type,
    description: asset.description,
    source: 'library',
    enabled,
    priority
  }))
}

export const getComponents = defineTool({
  name: 'get_components',
  description:
    'List reusable components from the document and enabled component libraries, optionally filtered by name.',
  execution: { kind: 'async', mutation: 'none' },
  input: v.strictObject({
    name: v.optional(
      v.pipe(v.string(), v.description('Filter by name (case-insensitive substring)'))
    ),
    source: v.optional(
      v.pipe(v.picklist(['all', 'document', 'libraries']), v.description('Component source')),
      'all'
    ),
    library_id: v.optional(
      v.pipe(v.string(), v.description('Filter library components by library ID'))
    ),
    limit: v.optional(
      toolNumber(
        v.pipe(v.number(), v.integer(), v.minValue(0), v.description('Max results (default: 50)'))
      )
    )
  }),
  execute: async (figma, args) => {
    const limit = args.limit ?? 50
    const source = args.source
    const nameFilter = args.name?.toLowerCase()
    const documentComponents: DocumentComponentResult[] = []
    const libraryComponents = source === 'document' ? [] : await listLibraryComponents(figma, args)
    // Library components sort ahead of the document's, so when they fill the list no page loads.
    const libraryFilled = libraryComponents.filter(({ priority }) => priority > -1).length >= limit

    if (source !== 'libraries' && !libraryFilled) {
      for (const page of figma.root.children) {
        if (documentComponents.length >= limit) break
        // Pages load as the search reaches them, so a short list loads only the pages it needs.
        await page.loadAsync()
        page.findAll((node) => {
          if (documentComponents.length >= limit) return false
          if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') return false
          if (nameFilter && !node.name.toLowerCase().includes(nameFilter)) return false
          const componentPropertyDefinitions = figma.graph.getNode(
            node.id
          )?.componentPropertyDefinitions
          documentComponents.push({
            id: node.id,
            name: node.name,
            type: node.type,
            page: page.name,
            source: 'document',
            ...(componentPropertyDefinitions && componentPropertyDefinitions.length > 0
              ? { componentPropertyDefinitions }
              : {})
          })
          return false
        })
      }
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
