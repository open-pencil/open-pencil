import * as v from 'valibot'

import type { SceneGraph, VariableType } from '@open-pencil/scene-graph'

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
  name: 'design_to_tokens',
  description:
    'Write the document variables as a stylesheet of CSS custom properties: defaults in :root, every other mode under its condition (a selector such as [data-theme="dark"] or an @media query), aliases as var() references. The tailwind format puts tokens with a Tailwind v4 namespace (--color-*, --spacing-*, --radius-*, --text-*, …) in @theme and adds a @custom-variant per mode. The dtcg format returns W3C design token files instead: one per collection mode, text and effect styles as typography and shadow tokens, and a resolver document; collection and type filters do not apply to it. Issues lists tokens or modes that could not be written.',
  execution: { kind: 'async', mutation: 'none' },
  input: v.object({
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
      const { files, issues } = exportDesignTokens(figma.graph)
      return { files, issues: issues.map(designTokenIssueMessage) }
    }
    const { css, tokenCount, issues } = await exportTokenStylesheet(figma.graph, {
      ...args,
      format: args.format
    })
    return { output: css, tokenCount, issues }
  }
})

export const importDesignTokens = defineTool({
  name: 'import_design_tokens',
  description:
    'Import W3C design token (DTCG) files into the document as variables, and typography and shadow tokens as text and effect styles. Pass each file with its path: a file per mode grouped by folder (as Figma exports modes), a .resolver.json with the files it refers to, or a Tokens Studio file with $themes. Collections and modes with the same names as existing ones are updated, variables are matched by name, and nothing is deleted. Returns what was added, updated, and skipped and why.',
  execution: { kind: 'async', mutation: 'document' },
  input: v.object({
    files: v.pipe(
      v.array(v.object({ path: v.string(), text: v.string() })),
      v.minLength(1),
      v.description('Token files, each with its path (folders name collections) and JSON text')
    ),
    add_missing: v.optional(
      v.pipe(v.boolean(), v.description('Add tokens that match no variable (default true)')),
      true
    ),
    styles: v.optional(
      v.pipe(v.boolean(), v.description('Make text and effect styles (default true)')),
      true
    )
  }),
  execute: async (figma, args) => {
    const tokens = await import('#core/io/formats/design-tokens')
    const bundle = tokens.readDesignTokens(args.files)
    const options = {
      ...tokens.defaultTokenImportOptions(figma.graph, bundle),
      addMissing: args.add_missing,
      styles: args.styles
    }
    const plan = tokens.planTokenImport(figma.graph, bundle, options)
    tokens.importTokensIntoGraph(figma.graph, figma.currentPageId, plan)
    return {
      ...plan.counts,
      collections: plan.collections.map((collection) => collection.name),
      skipped: plan.skipped,
      issues: bundle.issues
    }
  }
})
