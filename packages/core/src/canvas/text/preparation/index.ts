import type { TypefaceFontProvider } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'

import type { TextLayout } from '#core/canvas/text/layout'
import type { ParagraphBuildOptions } from '#core/canvas/text/paint'
import { fontManager } from '#core/text/fonts'

import type { PreparedText, TextPreparationCache } from './cache'

interface PreparationRenderer {
  textPreparationCache?: TextPreparationCache
  fontProvider?: TypefaceFontProvider | null
}

export function withPreparedText<T>(
  r: PreparationRenderer,
  node: SceneNode,
  variant: string,
  build: () => TextLayout,
  consume: (prepared: PreparedText) => T,
  cacheAllowed = true
): T {
  if (cacheAllowed && r.textPreparationCache && r.fontProvider) {
    return r.textPreparationCache.use(
      node,
      variant,
      fontManager.generation(),
      r.fontProvider,
      build,
      consume
    )
  }
  const paragraph = build()
  try {
    return consume({ paragraph })
  } finally {
    paragraph.delete()
  }
}

/** Borrow native text without caching mutable foreground shaders or transferring resource ownership. */
export function withTextParagraph<T>(
  r: PreparationRenderer & {
    buildParagraph: (
      node: SceneNode,
      color: Float32Array,
      options: ParagraphBuildOptions
    ) => TextLayout
  },
  node: SceneNode,
  color: Float32Array,
  options: ParagraphBuildOptions,
  draw: (paragraph: TextLayout) => T
): T {
  return withPreparedText(
    r,
    node,
    `draw:${Boolean(options.halfLeading)}:${color.join(',')}`,
    () => r.buildParagraph(node, color, options),
    (prepared) => draw(prepared.paragraph),
    !options.foregroundPaint
  )
}
