import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { TEXT_METRIC_FIELDS } from '@open-pencil/scene-graph/fields'

import { measureTextForLayout } from './text-measurement'

/** Case and direction change what the lines hold, so how wide they are and where they break. */
const TEXT_CONTENT_FIELDS = ['textCase', 'textDirection'] as const

export const TEXT_AUTO_RESIZE_KEYS = new Set<keyof SceneNode>([
  ...TEXT_METRIC_FIELDS,
  ...TEXT_CONTENT_FIELDS,
  'lineHeight',
  'textAutoResize',
  'width',
  'maxLines'
])

const TEXT_AUTO_WIDTH_KEYS = new Set<keyof SceneNode>([
  ...TEXT_METRIC_FIELDS,
  ...TEXT_CONTENT_FIELDS,
  'textAutoResize'
])

export function hasTextAutoResizeChange(changes: Partial<SceneNode>): boolean {
  return Object.keys(changes).some((key) => TEXT_AUTO_RESIZE_KEYS.has(key as keyof SceneNode))
}

function hasTextAutoWidthChange(changes: Partial<SceneNode>): boolean {
  return Object.keys(changes).some((key) => TEXT_AUTO_WIDTH_KEYS.has(key as keyof SceneNode))
}

type TextSizeChanges = Partial<
  Pick<SceneNode, 'width' | 'height' | 'derivedLayout' | 'derivedTextGlyphs' | 'derivedTextHeight'>
>

export function textAutoResizeChanges(
  node: SceneNode | undefined,
  changes: Partial<SceneNode>
): TextSizeChanges {
  if (node?.type !== 'TEXT' || !hasTextAutoResizeChange(changes)) return {}
  // Path text is laid out along its path (derivedTextGlyphs on textPathBox),
  // not by paragraph auto-resize. Running the measurement here would null the
  // derived glyphs — destroying the on-path lettering — whenever an imported
  // TEXT_PATH carries textAutoResize HEIGHT/WIDTH_AND_HEIGHT and a keystroke
  // can't reflow (font outlines or the layout path unavailable). pathTextEditChanges
  // owns path-text reflow; leave its glyphs alone.
  if (node.textPathData) return {}

  const next = { ...node, ...changes }
  const mode = next.textAutoResize
  // A fixed-size box keeps its size; its lines are measured at its width, since they draw past it.
  if (mode !== 'HEIGHT' && mode !== 'WIDTH_AND_HEIGHT')
    return { derivedTextHeight: measureTextForLayout(next, next.width).height || null }

  const maxWidth = mode === 'HEIGHT' ? next.width : undefined
  const measured = measureTextForLayout(next, maxWidth)
  const resized: TextSizeChanges = {
    derivedLayout: null,
    derivedTextGlyphs: null,
    derivedTextHeight: null
  }

  if (mode === 'WIDTH_AND_HEIGHT' && hasTextAutoWidthChange(changes) && measured.width > 0)
    resized.width = measured.width
  if (measured.height > 0) resized.height = measured.height

  return resized
}

/**
 * Measures the text under `rootId` that resizes to its content; `wrappingOnly` measures only text
 * that wraps, at the width it has now. Auto layout measures the text it holds when it lays out;
 * text anywhere else keeps the size it was created with otherwise. Reports whether a size changed.
 */
export function sizeAutoResizingText(
  graph: SceneGraph,
  rootId: string,
  wrappingOnly = false
): boolean {
  let changed = false
  const stack = [rootId]
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    const node = graph.getNode(id)
    if (!node) continue
    stack.push(...node.childIds)
    if (node.type !== 'TEXT' || (wrappingOnly && node.textAutoResize !== 'HEIGHT')) continue
    // Wrapping text the source gave no width wraps at the width its content takes.
    const unsized = node.textAutoResize === 'HEIGHT' && node.width <= 0
    const changes = textAutoResizeChanges(node, {
      textAutoResize: unsized ? 'WIDTH_AND_HEIGHT' : node.textAutoResize
    })
    const resized =
      (changes.width !== undefined && changes.width !== node.width) ||
      (changes.height !== undefined && changes.height !== node.height)
    // A fixed-size box only learns how far its lines reach, which needs no layout.
    const measured =
      changes.derivedTextHeight !== undefined &&
      changes.derivedTextHeight !== node.derivedTextHeight
    if (resized || measured) graph.updateNode(id, changes)
    changed ||= resized
  }
  return changed
}
