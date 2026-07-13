import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'

import { fontManager } from '#core/text/fonts'
import { collectNodeFontKeys, type TextNodeFontSource } from '#core/text/requirements'

export interface TextFontRenderer {
  ck: CanvasKit
  fontProvider: TypefaceFontProvider | null
}

/**
 * Load every face a TEXT node uses (base + style runs) and register it on the renderer's
 * live provider. Figma's derived outlines paint without CanvasKit faces, but live edit
 * drops those outlines and paints through Paragraph — which needs the real faces.
 */
export async function ensureTextNodeFonts(
  node: Pick<SceneNode, 'type'> & TextNodeFontSource,
  renderer?: TextFontRenderer | null
): Promise<void> {
  if (node.type !== 'TEXT') return
  if (renderer?.fontProvider) fontManager.bindProvider(renderer.ck, renderer.fontProvider)

  const styles = collectNodeFontKeys(node)
  await Promise.all(styles.map(([family, style]) => fontManager.loadFont(family, style)))
}
