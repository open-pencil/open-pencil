import * as v from 'valibot'

import type { ComponentPropertyDefinition } from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api'
import { graphOf } from '#core/figma-api/graph'
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

/**
 * A library the catalog knows but cannot enumerate components for — still syncing, or enabled
 * at a revision whose manifest has not arrived. It reports only library identity; callers that
 * want its components retry after the mirror fills.
 */
interface LibraryStubResult {
  libraryId: string
  libraryName: string
  source: 'library'
}

type ListedComponent = LibraryComponentResult | LibraryStubResult | DocumentComponentResult

const isAssetRow = (item: ListedComponent): item is LibraryComponentResult => 'priority' in item
const priorityOf = (item: ListedComponent): number => (isAssetRow(item) ? item.priority : -1)
const nameOf = (item: ListedComponent): string => {
  if (item.source === 'document' || isAssetRow(item)) return item.name
  return item.libraryName
}

/**
 * The library components the document's catalog has, matching `name` and `libraryId`.
 * An enabled library with no component rows — still syncing, or empty — keeps a stub entry
 * instead of disappearing from the list; libraries the document never enabled do not.
 */
async function listLibraryComponents(
  figma: FigmaAPI,
  args: { name?: string; library_id?: string }
): Promise<(LibraryComponentResult | LibraryStubResult)[]> {
  const graph = graphOf(figma)
  const catalog = getComponentCatalog(graph)
  if (!catalog) return []
  const [summaries, assets] = await Promise.all([
    catalog.listLibraries(),
    catalog.listComponents({
      name: args.name,
      libraryId: args.library_id,
      enabledOnly: true
    })
  ])
  const covered = new Set(assets.map((asset) => asset.libraryId))
  const results: (LibraryComponentResult | LibraryStubResult)[] = assets.map(
    ({ libraryId, libraryName, revisionId, enabled, priority, asset }) => ({
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
    })
  )
  for (const summary of summaries) {
    // Stub rows represent a library that could not enumerate components only when the
    // document asked for it: enabled but still syncing, not merely mirrored.
    if (args.library_id && args.library_id !== summary.libraryId) continue
    if (!graph.enabledLibraries.get(summary.libraryId)?.enabled) continue
    if (covered.has(summary.libraryId)) continue
    results.push({ libraryId: summary.libraryId, libraryName: summary.name, source: 'library' })
  }
  return results
}

export const getComponents = defineTool({
  name: 'list_components',
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
    const libraryFilled =
      libraryComponents.filter((item) => isAssetRow(item) && item.priority > -1).length >= limit

    if (source !== 'libraries' && !libraryFilled) {
      for (const page of figma.root.children) {
        if (documentComponents.length >= limit) break
        // Pages load as the search reaches them, so a short list loads only the pages it needs.
        await page.loadAsync()
        page.findAll((node) => {
          if (documentComponents.length >= limit) return false
          if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') return false
          if (nameFilter && !node.name.toLowerCase().includes(nameFilter)) return false
          const componentPropertyDefinitions = graphOf(figma).getNode(
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
      .sort(
        (left, right) =>
          priorityOf(right) - priorityOf(left) || nameOf(left).localeCompare(nameOf(right))
      )
      .slice(0, limit)
    return { count: components.length, components }
  }
})
