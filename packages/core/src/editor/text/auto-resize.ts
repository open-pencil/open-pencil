import type { SceneNode } from '@open-pencil/scene-graph'

import { estimateTextSize, getTextMeasurer } from '#core/layout/text-measurement'

export const TEXT_AUTO_RESIZE_KEYS = new Set<keyof SceneNode>([
  'text',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'italic',
  'lineHeight',
  'letterSpacing',
  'styleRuns',
  'fontVariations',
  'fontFeatures',
  'textAutoResize',
  'width',
  'maxLines'
])

const TEXT_AUTO_WIDTH_KEYS = new Set<keyof SceneNode>([
  'text',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'italic',
  'letterSpacing',
  'styleRuns',
  'fontVariations',
  'fontFeatures',
  'textAutoResize'
])

export function hasTextAutoResizeChange(changes: Partial<SceneNode>): boolean {
  return Object.keys(changes).some((key) => TEXT_AUTO_RESIZE_KEYS.has(key as keyof SceneNode))
}

function hasTextAutoWidthChange(changes: Partial<SceneNode>): boolean {
  return Object.keys(changes).some((key) => TEXT_AUTO_WIDTH_KEYS.has(key as keyof SceneNode))
}

export function textAutoResizeChanges(
  node: SceneNode | undefined,
  changes: Partial<SceneNode>
): Partial<Pick<SceneNode, 'width' | 'height' | 'figmaDerivedLayout' | 'figmaDerivedTextGlyphs'>> {
  if (node?.type !== 'TEXT' || !hasTextAutoResizeChange(changes)) return {}
  // Path text is laid out along its path (figmaDerivedTextGlyphs on textPathBox),
  // not by paragraph auto-resize. Running the measurement here would null the
  // derived glyphs — destroying the on-path lettering — whenever an imported
  // TEXT_PATH carries textAutoResize HEIGHT/WIDTH_AND_HEIGHT and a keystroke
  // can't reflow (font outlines or the layout path unavailable). pathTextEditChanges
  // owns path-text reflow; leave its glyphs alone.
  if (node.textPathBox) return {}

  const next = { ...node, ...changes }
  const mode = next.textAutoResize
  if (mode !== 'HEIGHT' && mode !== 'WIDTH_AND_HEIGHT') return {}

  const maxWidth = mode === 'HEIGHT' ? next.width : undefined
  const measured = getTextMeasurer()?.(next, maxWidth) ?? estimateTextSize(next, maxWidth)
  const resized: Partial<
    Pick<SceneNode, 'width' | 'height' | 'figmaDerivedLayout' | 'figmaDerivedTextGlyphs'>
  > = {
    figmaDerivedLayout: null,
    figmaDerivedTextGlyphs: null
  }

  if (mode === 'WIDTH_AND_HEIGHT' && hasTextAutoWidthChange(changes) && measured.width > 0)
    resized.width = measured.width
  if (measured.height > 0) resized.height = measured.height

  return resized
}
