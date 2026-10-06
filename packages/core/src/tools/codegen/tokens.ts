import * as v from 'valibot'

import type { SceneGraph, VariableType } from '@open-pencil/scene-graph'

import { defineTool } from '#core/tools/schema'

export type TokenExportOptions = {
  format: 'css' | 'tailwind'
  /** Collection name, matched as a case-insensitive substring. */
  collection?: string
  type?: VariableType
}

export type TokenExport = { css: string; tokenCount: number; issues: string[] }

/** The document's variables as a token stylesheet, shared by the tool, the CLI, and the app. */
export async function exportTokenStylesheet(
  graph: SceneGraph,
  options: TokenExportOptions
): Promise<TokenExport> {
  const query = options.collection?.toLowerCase()
  const collectionIds = new Set(
    [...graph.variableCollections.values()]
      .filter((collection) => !query || collection.name.toLowerCase().includes(query))
      .map((collection) => collection.id)
  )
  const ids = new Set(
    [...graph.variables.values()]
      .filter((variable) => collectionIds.has(variable.collectionId))
      .filter((variable) => !options.type || variable.type === options.type)
      .map((variable) => variable.id)
  )
  if (ids.size === 0) return { css: '', tokenCount: 0, issues: [] }

  const { tokenStylesheet } = await import('@open-pencil/dom-css/export')
  const { css, issues } = await tokenStylesheet(graph, {
    format: options.format,
    include: (variable) => ids.has(variable.id)
  })
  return { css, tokenCount: ids.size, issues: issues.map((issue) => issue.message) }
}

export const designToTokens = defineTool({
  name: 'design_to_tokens',
  description:
    'Write the document variables as a stylesheet of CSS custom properties: defaults in :root, every other mode under its condition (a selector such as [data-theme="dark"] or an @media query), aliases as var() references. The tailwind format puts tokens with a Tailwind v4 namespace (--color-*, --spacing-*, --radius-*, --text-*, …) in @theme and adds a @custom-variant per mode. Issues lists tokens or modes that could not be written.',
  execution: { kind: 'async', mutation: 'none' },
  input: v.object({
    format: v.optional(
      v.pipe(
        v.picklist(['css', 'tailwind']),
        v.description('css: :root and mode scopes; tailwind: @theme, mode scopes and variants')
      ),
      'css'
    ),
    collection: v.optional(
      v.pipe(v.string(), v.description('Filter by collection name (substring, case-insensitive)'))
    ),
    type: v.optional(
      v.pipe(
        v.picklist(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']),
        v.description('Filter by variable type')
      )
    )
  }),
  execute: async (figma, args) => {
    const { css, tokenCount, issues } = await exportTokenStylesheet(figma.graph, args)
    return { output: css, tokenCount, issues }
  }
})
