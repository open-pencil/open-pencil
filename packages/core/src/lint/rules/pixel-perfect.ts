import { defineRule } from '#core/lint/rule'
import type { LintFixProperty, LintNode } from '#core/lint/types'

type Geometry = Extract<LintFixProperty, 'x' | 'y' | 'width' | 'height'>

/** Vector artwork and the parts of groups and boolean shapes are drawn relative to each other. */
const ARTWORK_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'LINE'])
const ARTWORK_PARENTS = new Set(['GROUP', 'BOOLEAN_OPERATION'])

/**
 * Rounding one part of a drawing on its own shifts it against the others, so artwork gets no
 * fix; its findings stay for review.
 */
function isArtwork(node: LintNode, parent: LintNode | null): boolean {
  return ARTWORK_TYPES.has(node.type) || (parent !== null && ARTWORK_PARENTS.has(parent.type))
}

/** Width and height along a horizontal or vertical auto layout's primary and counter axes. */
function axes(layoutMode: string): [Geometry, Geometry] | null {
  if (layoutMode === 'HORIZONTAL') return ['width', 'height']
  if (layoutMode === 'VERTICAL') return ['height', 'width']
  return null
}

/** Geometry that auto layout or text auto-resize recomputes, where rounding would not stick. */
function layoutOwnedGeometry(node: LintNode, parent: LintNode | null): Set<Geometry> {
  const owned = new Set<Geometry>()
  if (parent && parent.layoutMode !== 'NONE' && node.layoutPositioning === 'AUTO') {
    owned.add('x').add('y')
    const parentAxes = axes(parent.layoutMode)
    if (parentAxes && node.layoutGrow > 0) owned.add(parentAxes[0])
    if (parentAxes && node.layoutAlignSelf === 'STRETCH') owned.add(parentAxes[1])
  }
  if (node.type === 'TEXT') {
    if (node.textAutoResize === 'WIDTH_AND_HEIGHT') owned.add('width').add('height')
    if (node.textAutoResize === 'HEIGHT') owned.add('height')
  }
  const ownAxes = axes(node.layoutMode)
  if (ownAxes && node.primaryAxisSizing !== 'FIXED') owned.add(ownAxes[0])
  if (ownAxes && node.counterAxisSizing !== 'FIXED') owned.add(ownAxes[1])
  return owned
}

export default defineRule({
  meta: {
    id: 'pixel-perfect',
    category: 'layout',
    description: 'Elements should align to whole pixels'
  },
  check(node, context) {
    const values: Array<[Geometry, number]> = [
      ['x', node.x],
      ['y', node.y],
      ['width', node.width],
      ['height', node.height]
    ]
    const subpixel = values.filter(([, value]) => Math.abs(value - Math.round(value)) >= 0.01)
    if (subpixel.length === 0) return
    const parent = context.getParent(node)
    const owned = layoutOwnedGeometry(node, parent)
    const rounded = subpixel
      .filter(([key]) => !isArtwork(node, parent) && !owned.has(key))
      .map(([key, value]) => [key, Math.round(value)] as const)
    context.report({
      node,
      message: `Subpixel values: ${subpixel.map(([k, v]) => `${k}: ${v}`).join(', ')}`,
      suggest: 'Round to whole pixels for crisp rendering',
      data: Object.fromEntries(subpixel),
      fix: rounded.length > 0 ? { kind: 'set', changes: Object.fromEntries(rounded) } : undefined
    })
  }
})
