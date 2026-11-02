import type { FigmaAPI, FigmaNodeProxy } from '#core/figma-api'

export type Fit = 'contain' | 'cover'

export interface Box {
  width: number
  height: number
}

/** The uniform scale that fits `content` into `target`. */
export function fitScale(content: Box, target: Box, fit: Fit): number {
  const sx = target.width / content.width
  const sy = target.height / content.height
  return fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy)
}

/**
 * Copies `source` into `container`, scaled uniformly (text, strokes and radii too) and centred.
 * The source itself is left untouched.
 */
export function placeCopy(
  source: FigmaNodeProxy,
  container: FigmaNodeProxy,
  target: Box,
  fit: Fit
): FigmaNodeProxy {
  if (source.width <= 0 || source.height <= 0) throw new Error(`Node ${source.id} has no size`)
  const copy = source.clone()
  container.appendChild(copy)
  const scale = fitScale(source, target, fit)
  if (Math.abs(scale - 1) > 1e-9) copy.rescale(scale)
  copy.x = (target.width - copy.width) / 2
  copy.y = (target.height - copy.height) / 2
  return copy
}

/** Places a new top-level node to the right of everything already on the page. */
export function nextFreeX(figma: FigmaAPI, gap = 100): number {
  let right = 0
  for (const node of figma.currentPage.children) right = Math.max(right, node.x + node.width)
  return figma.currentPage.children.length === 0 ? 0 : right + gap
}
