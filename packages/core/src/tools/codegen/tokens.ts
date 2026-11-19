import * as v from 'valibot'

import type { SceneGraph, VariableType } from '@open-pencil/scene-graph'

import { graphOf } from '#core/figma-api/graph'
import type { DesignTokenFile } from '#core/io/formats/design-tokens'
import { defineTool } from '#core/tools/schema'

export type TokenExportOptions = {
  format: 'css' | 'tailwind'
  /** Collection name, matched as a case-insensitive substring. */
  collection?: string
  type?: VariableType
}

export type TokenExport = {
  css: string
  tokenCount: number
  issues: string[]
  /** W3C design token files, for the `dtcg` format. */
  files?: DesignTokenFile[]
}

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
  name: 'export_design_tokens',
  description:
    'Write the document variables as CSS custom properties: defaults in :root, other modes under their selector or @media query, aliases as var(). tailwind puts Tailwind v4 namespaces (--color-*, --spacing-*, …) in @theme with a @custom-variant per mode. dtcg returns W3C design token files instead, one per collection mode with text and effect styles and a resolver; collection and type filters do not apply. Issues lists what could not be written.',
  execution: { kind: 'async', mutation: 'none' },
  input: v.strictObject({
    format: v.optional(
      v.pipe(
        v.picklist(['css', 'tailwind', 'dtcg']),
        v.description(
          'css: :root and mode scopes; tailwind: @theme, mode scopes and variants; dtcg: W3C design token files'
        )
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
    if (args.format === 'dtcg') {
      const { designTokenIssueMessage, exportDesignTokens } =
        await import('#core/io/formats/design-tokens')
      const { files, issues } = exportDesignTokens(graphOf(figma))
      return { files, issues: issues.map(designTokenIssueMessage) }
    }
    const { css, tokenCount, issues } = await exportTokenStylesheet(graphOf(figma), {
      ...args,
      format: args.format
    })
    return { output: css, tokenCount, issues }
  }
})

export const importDesignTokens = defineTool({
  name: 'import_design_tokens',
  description:
    'Import W3C design token (DTCG) files as variables, and typography and shadow tokens as text and effect styles. Pass each file with its path: a file per mode in folders (as Figma exports), a .resolver.json with its files, or a Tokens Studio file with $themes. Same-named collections, modes, and variables are updated; nothing is deleted. Returns what was added, updated, and skipped and why.',
  execution: { kind: 'async', mutation: 'document' },
  input: v.strictObject({
    files: v.pipe(
      v.array(v.object({ path: v.string(), text: v.string() })),
      v.minLength(1),
      v.description('Token files, each with its path (folders name collections) and JSON text')
    ),
    add_missing: v.optional(
      v.pipe(v.boolean(), v.description('Add tokens that match no variable')),
      true
    ),
    styles: v.optional(v.pipe(v.boolean(), v.description('Make text and effect styles')), true)
  }),
  execute: async (figma, args) => {
    const tokens = await import('#core/io/formats/design-tokens')
    const bundle = tokens.readDesignTokens(args.files)
    const options = {
      ...tokens.defaultTokenImportOptions(graphOf(figma), bundle),
      addMissing: args.add_missing,
      styles: args.styles
    }
    const plan = tokens.planTokenImport(graphOf(figma), bundle, options)
    tokens.importTokensIntoGraph(graphOf(figma), figma.currentPageId, plan)
    return {
      ...plan.counts,
      collections: plan.collections.map((collection) => collection.name),
      skipped: plan.skipped,
      issues: bundle.issues
    }
  }
})
