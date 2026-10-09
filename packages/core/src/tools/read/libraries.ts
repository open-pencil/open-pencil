import * as v from 'valibot'

import { getComponentCatalog } from '#core/tools/component-catalog'
import { toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

export const listLibraries = defineTool({
  name: 'list_libraries',
  description: 'List available published component libraries.',
  execution: { kind: 'async', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.strictObject({}),
  execute: async (figma) => {
    const catalog = getComponentCatalog(figma.graph)
    const libraries = catalog ? await catalog.listLibraries() : []
    return { count: libraries.length, libraries }
  }
})

export const insertLibraryComponent = defineTool({
  name: 'insert_library_component',
  description:
    'Insert a reusable component from an enabled library by stable library and asset identity.',

  execution: { kind: 'async', mutation: 'document' },
  input: v.strictObject({
    library_id: v.pipe(v.string(), v.description('Library ID')),
    revision_id: v.optional(v.pipe(v.string(), v.description('Pinned revision ID'))),
    asset_key: v.pipe(v.string(), v.description('Stable asset key')),
    parent_id: v.optional(v.pipe(v.string(), v.description('Optional parent node ID'))),
    x: v.optional(toolNumber(v.pipe(v.number(), v.description('X position')))),
    y: v.optional(toolNumber(v.pipe(v.number(), v.description('Y position')))),
    variant_values: v.optional(
      v.pipe(v.string(), v.description('Optional JSON object of variant property values'))
    )
  }),
  execute: async (figma, args) => {
    const catalog = getComponentCatalog(figma.graph)
    if (!catalog) throw new Error('No component library catalog is configured')
    let variantValues: Record<string, string> | undefined
    if (args.variant_values) {
      const parsed: unknown = JSON.parse(args.variant_values)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new TypeError('variant_values must be a JSON object')
      }
      const entries = Object.entries(parsed)
      if (entries.some(([, value]) => typeof value !== 'string')) {
        throw new TypeError('variant_values values must be strings')
      }
      variantValues = Object.fromEntries(entries) as Record<string, string>
    }
    return catalog.insertComponent({
      libraryId: args.library_id,
      revisionId: args.revision_id,
      assetKey: args.asset_key,
      parentId: args.parent_id,
      x: args.x,
      y: args.y,
      variantValues
    })
  }
})
