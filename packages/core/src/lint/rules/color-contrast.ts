import { colorToHex, compositeOver, contrastRatio } from '@open-pencil/scene-graph/color'
import { BLACK } from '@open-pencil/scene-graph/constants'
import {
  clipPolygon,
  degToRad,
  rotatedCorners,
  rotatePoint
} from '@open-pencil/scene-graph/geometry'
import type { Color, Vector } from '@open-pencil/scene-graph/primitives'

import { defineRule } from '#core/lint/rule'
import type { LintNode, RuleContext } from '#core/lint/types'

/** WCAG AA: 4.5:1 for text, 3:1 for large text, which is 24px, or 18.66px when bold. */
const MIN_CONTRAST = 4.5
const MIN_LARGE_CONTRAST = 3
const LARGE_TEXT_PX = 24
const LARGE_BOLD_TEXT_PX = 18.66
const BOLD_WEIGHT = 700

function minContrast(style: { fontSize: number; fontWeight: number }): number {
  const large =
    style.fontSize >= LARGE_TEXT_PX ||
    (style.fontSize >= LARGE_BOLD_TEXT_PX && style.fontWeight >= BOLD_WEIGHT)
  return large ? MIN_LARGE_CONTRAST : MIN_CONTRAST
}

/** The strictest threshold any stretch of the text needs. */
function requiredContrast(node: {
  fontSize: number
  textStyles?: { fontSize: number; fontWeight: number }[]
}): number {
  const styles = node.textStyles ?? [{ fontSize: node.fontSize, fontWeight: 0 }]
  return Math.max(...styles.map(minContrast))
}

type SolidPaint = LintNode['fills'][number] & {
  color: NonNullable<LintNode['fills'][number]['color']>
}

function isSolidPaint(fill: LintNode['fills'][number]): fill is SolidPaint {
  return fill.type === 'SOLID' && fill.visible && fill.color != null
}

function opaque(color: Pick<Color, 'r' | 'g' | 'b'>): Color {
  return { ...color, a: 1 }
}

/** Layers whose box is painted edge to edge, so their fills cover whatever their box covers. */
const BOX_TYPES = new Set(['FRAME', 'RECTANGLE', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'])

/** The corners of a layer's box in its parent's space; layers turn around their centre. */
function boxCorners(node: LintNode): Vector[] {
  const halfWidth = node.width / 2
  const halfHeight = node.height / 2
  return rotatedCorners(
    node.x + halfWidth,
    node.y + halfHeight,
    halfWidth,
    halfHeight,
    node.rotation
  )
}

/** `points` in `container`'s space, moved to its parent's space. */
function toParentSpace(points: Vector[], container: LintNode): Vector[] {
  const rad = degToRad(container.rotation)
  return points.map((point) => {
    const turned = rotatePoint(point.x, point.y, container.width / 2, container.height / 2, rad)
    return { x: turned.x + container.x, y: turned.y + container.y }
  })
}

function area(polygon: Vector[]): number {
  let twice = 0
  for (const [index, point] of polygon.entries()) {
    const next = polygon[(index + 1) % polygon.length]
    twice += point.x * next.y - next.x * point.y
  }
  return Math.abs(twice) / 2
}

/** How much of the text's quad `layer` covers: none, all of it, or part. */
function coverage(text: Vector[], layer: LintNode): 'none' | 'all' | 'part' {
  const covered = area(clipPolygon(text, boxCorners(layer)) ?? [])
  if (covered <= 0) return 'none'
  return covered >= area(text) - 1e-6 ? 'all' : 'part'
}

interface Coat {
  color: Color
  /** How much of what lies under it the coat hides: 1 for opaque. */
  alpha: number
}

/**
 * A layer's fills composited over nothing, in paint order, as the renderer draws them before
 * applying the layer's opacity; null when a gradient or image shows, since those are not
 * composited yet.
 */
function flatten(paints: LintNode['fills']): Coat | null {
  let coat: Coat = { color: { ...BLACK }, alpha: 0 }
  let unresolved = false
  for (const paint of paints) {
    if (!paint.visible || paint.opacity <= 0) continue
    if (!isSolidPaint(paint)) {
      unresolved ||= paint.type !== 'SOLID'
      continue
    }
    if (paint.opacity >= 1) {
      coat = { color: opaque(paint.color), alpha: 1 }
      unresolved = false
      continue
    }
    // Over a partly covered coat the paint's share of the result is its opacity over the total.
    const alpha = paint.opacity + coat.alpha * (1 - paint.opacity)
    coat = { color: compositeOver(opaque(paint.color), coat.color, paint.opacity / alpha), alpha }
  }
  return unresolved ? null : coat
}

/**
 * Puts a layer's fills, at the layer's `opacity`, under the translucent `coats` collected so
 * far: the backdrop once that completes it with something opaque, `null` when a gradient or
 * image shows, and `undefined` while everything collected is translucent.
 */
function coatUnder(
  coats: Coat[],
  paints: LintNode['fills'],
  opacity: number
): Color | null | undefined {
  const coat = flatten(paints)
  if (!coat) return null
  const alpha = coat.alpha * opacity
  if (alpha <= 0) return undefined
  if (alpha < 1) {
    coats.push({ color: coat.color, alpha })
    return undefined
  }
  return coats.reduceRight((bg, layer) => compositeOver(layer.color, bg, layer.alpha), coat.color)
}

/** The children of `parent` painted before `child`, topmost first. */
function layersBelow(parent: LintNode, child: LintNode, context: RuleContext): LintNode[] {
  const siblings = context.getChildren(parent)
  const index = siblings.findIndex((sibling) => sibling.id === child.id)
  return siblings.slice(0, Math.max(index, 0)).toReversed()
}

/**
 * What the text sits on, in paint order: at each ancestor, the layers painted before the
 * branch holding the text, topmost first, then the ancestor's own fills. Translucent solid
 * fills are composited over the nearest opaque one. Undefined when nothing opaque is under the
 * text, since what shows through a translucent fill then is not part of the design; when a
 * gradient or image shows above it; and when a layer under the text covers only part of it or
 * is not a box, since the text then has more than one background.
 */
function backdrop(node: LintNode, context: RuleContext): Color | undefined {
  const coats: Coat[] = []
  let text = boxCorners(node)
  let branch = node
  for (let parent = context.getParent(node); parent; parent = context.getParent(parent)) {
    for (const layer of layersBelow(parent, branch, context)) {
      if (!layer.visible || layer.opacity <= 0 || layer.type === 'TEXT') continue
      const paints = layer.fills.some((paint) => paint.visible && paint.opacity > 0)
      // A layer that paints nothing itself and holds no layers leaves the text as it was.
      if (!paints && layer.childIds.length === 0) continue
      const covers = coverage(text, layer)
      if (covers === 'none') continue
      if (covers === 'part' || !BOX_TYPES.has(layer.type) || layer.childIds.length > 0)
        return undefined
      const result = coatUnder(coats, layer.fills, layer.opacity)
      if (result !== undefined) return result ?? undefined
    }
    const result = coatUnder(coats, parent.fills, 1)
    if (result !== undefined) return result ?? undefined
    text = toParentSpace(text, parent)
    branch = parent
  }
  return undefined
}

export default defineRule({
  meta: {
    id: 'color-contrast',
    category: 'accessibility',
    severity: 'error',
    description: 'Text must have sufficient contrast against its background'
  },
  match: ['TEXT'],
  check(node, context) {
    // Paints under the topmost opaque solid fill are covered by it.
    const base = node.fills.findLastIndex((paint) => isSolidPaint(paint) && paint.opacity >= 1)
    const visible = node.fills.slice(Math.max(base, 0))
    // Gradients and images are not composited yet, so a stack showing one has no single color.
    if (visible.some((paint) => paint.visible && paint.type !== 'SOLID' && paint.opacity > 0))
      return
    const text = visible.filter(isSolidPaint)
    if (!text.some((paint) => paint.opacity > 0)) return
    const bg = backdrop(node, context)
    if (!bg) return
    const fg = text.reduce(
      (color, paint) => compositeOver(opaque(paint.color), color, paint.opacity),
      bg
    )
    const ratio = contrastRatio(fg, bg)
    const minRatio = requiredContrast(node)
    if (ratio < minRatio)
      context.report({
        node,
        message: `Contrast ratio ${ratio.toFixed(2)}:1 is below WCAG AA`,
        suggest: 'Increase contrast between text and background',
        data: {
          ratio: Math.floor(ratio * 100) / 100,
          minRatio,
          foreground: colorToHex(fg),
          background: colorToHex(bg)
        }
      })
  }
})
