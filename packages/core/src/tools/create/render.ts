import { uniqBy } from 'es-toolkit'
import * as v from 'valibot'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { finishRenderPlacement, resolveRenderPlacement } from '#core/design-jsx/placement'
import type { FigmaAPI } from '#core/figma-api'
import { layoutAuthoredNodes } from '#core/layout'
import { collectNodeFontFaces } from '#core/text/requirements/collect'
import { toolNumber, defineTool } from '#core/tools/schema'

/** The fonts the text in a layer and its descendants uses. */
function subtreeFonts(graph: SceneGraph, id: string): Array<{ family: string; style: string }> {
  const node = graph.getNode(id)
  if (!node) return []
  const own = node.type === 'TEXT' ? collectNodeFontFaces(node) : []
  return [...own, ...node.childIds.flatMap((child) => subtreeFonts(graph, child))]
}

/**
 * Lays rendered layers out again in the fonts their text names. JSX names its fonts only as it
 * renders, so text was first measured in whatever face was loaded; a font that cannot load keeps
 * that face, as a file's missing font does.
 */
async function layoutInTheirFonts(figma: FigmaAPI, rootIds: string[]) {
  const fonts = uniqBy(
    rootIds.flatMap((id) => subtreeFonts(figma.graph, id)),
    (font) => `${font.family}\u0000${font.style}`
  )
  if (fonts.length === 0) return
  await Promise.all(fonts.map((font) => figma.loadFontAsync(font).catch(() => undefined)))
  layoutAuthoredNodes(figma.graph, rootIds)
}

export const render = defineTool({
  name: 'render',

  description:
    'Render JSX to design nodes. Draw a shape of your own as one layer with <Vector d="M2 12 L22 12" stroke="#000" />, styled like any layer; inline <svg> is for artwork copied from elsewhere and draws its shapes, without its text. Use replace_id to replace a placeholder while preserving its position.',
  execution: { kind: 'async', mutation: 'document' },
  input: v.strictObject({
    replace_id: v.optional(
      v.pipe(
        v.string(),
        v.description(
          'Node ID to replace — new node takes its position in parent, old node is deleted'
        )
      )
    ),
    parent_id: v.optional(v.pipe(v.string(), v.description('Parent node ID to render into'))),
    insert_index: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.description('Position among siblings (0 = first child). Omit to append at end.')
        )
      )
    ),
    x: v.optional(toolNumber(v.pipe(v.number(), v.description('X position of the root node')))),
    y: v.optional(toolNumber(v.pipe(v.number(), v.description('Y position of the root node')))),
    jsx: v.pipe(v.string(), v.description('JSX string to render'))
  }),
  execute: async (figma, args) => {
    const { designJSXRenderer } = await import('#core/design-jsx')
    const { renderJSX } = designJSXRenderer(figma.icons)

    const placement = resolveRenderPlacement(figma.graph, args, figma.currentPageId)
    const results = await renderJSX(figma.graph, args.jsx, placement)
    await layoutInTheirFonts(
      figma,
      results.map((node) => node.id)
    )
    finishRenderPlacement(figma.graph, results, placement)
    const result = results[0]

    const response: {
      id: string
      name: string
      type: string
      children: string[]
      warnings?: typeof result.warnings
      siblings?: Array<{ id: string; name: string; type: string }>
    } = {
      id: result.id,
      name: result.name,
      type: result.type,
      children: result.childIds
    }
    if (result.warnings) response.warnings = result.warnings
    if (results.length > 1) {
      response.siblings = results
        .slice(1)
        .map((node) => ({ id: node.id, name: node.name, type: node.type }))
    }
    return response
  }
})
