import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { resolvedPaintBindings } from '@open-pencil/scene-graph/variables'

import { backgroundCSS, solidColorCSS } from './paints'
import { boundValue, cssColor, cssNumber, px } from './values'

// A layer's CSS as Figma's Dev Mode gives it from `getCSSAsync` (Figma desktop 126), its
// properties in Figma's order.

type Declarations = [string, string][]

/** Layers Dev Mode draws as SVG, with `fill` and `stroke` rather than a background. */
const SVG_SHAPES = new Set<SceneNode['type']>([
  'ELLIPSE',
  'STAR',
  'POLYGON',
  'VECTOR',
  'BOOLEAN_OPERATION'
])

const JUSTIFY: Partial<Record<SceneNode['primaryAxisAlign'], string>> = {
  CENTER: 'center',
  MAX: 'flex-end',
  SPACE_BETWEEN: 'space-between'
}

const ALIGN: Record<SceneNode['counterAxisAlign'], string> = {
  MIN: 'flex-start',
  CENTER: 'center',
  MAX: 'flex-end',
  STRETCH: 'stretch',
  BASELINE: 'baseline'
}

const TEXT_ALIGN: Partial<Record<SceneNode['textAlignHorizontal'], string>> = {
  CENTER: 'center',
  RIGHT: 'right',
  JUSTIFIED: 'justify'
}

const TEXT_TRANSFORM: Partial<Record<SceneNode['textCase'], string>> = {
  UPPER: 'uppercase',
  LOWER: 'lowercase',
  TITLE: 'capitalize'
}

class Writer {
  readonly list: Declarations = []
  constructor(
    readonly graph: SceneGraph,
    readonly node: SceneNode
  ) {}

  set(property: string, value: string | null | undefined): void {
    if (value) this.list.push([property, value])
  }

  /** A length, or the variable bound to `field`. */
  length(field: string, value: number, zero = '0px'): string {
    return boundValue(this.graph, this.node, field, px(value, zero))
  }
}

function parentOf(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  return node.parentId ? graph.getNode(node.parentId) : undefined
}

function isAutoLayout(node: SceneNode | undefined): node is SceneNode {
  return node?.layoutMode === 'HORIZONTAL' || node?.layoutMode === 'VERTICAL'
}

/** Whether an auto-layout frame sizes `axis` to its content. */
function hugs(node: SceneNode, axis: 'width' | 'height'): boolean {
  if (!isAutoLayout(node)) return false
  const primary = (node.layoutMode === 'HORIZONTAL') === (axis === 'width')
  return (primary ? node.primaryAxisSizing : node.counterAxisSizing) === 'HUG'
}

/**
 * `width` and `height`, leaving out an axis the layer grows along, or hugs with something to
 * hug: an empty frame keeps the size it has, and Dev Mode writes it.
 */
function size(w: Writer, parent: SceneNode | undefined): void {
  const { node } = w
  const hugsContent = (axis: 'width' | 'height') => hugs(node, axis) && node.childIds.length > 0
  const grows = (axis: 'width' | 'height') =>
    isAutoLayout(parent) &&
    node.layoutPositioning !== 'ABSOLUTE' &&
    node.layoutGrow > 0 &&
    (parent.layoutMode === 'HORIZONTAL') === (axis === 'width')
  if (!hugsContent('width') && !grows('width')) w.set('width', w.length('width', node.width))
  if (!hugsContent('height') && !grows('height')) w.set('height', w.length('height', node.height))
  w.set('min-width', node.minWidth === null ? null : px(node.minWidth))
  w.set('max-width', node.maxWidth === null ? null : px(node.maxWidth))
  w.set('min-height', node.minHeight === null ? null : px(node.minHeight))
  w.set('max-height', node.maxHeight === null ? null : px(node.maxHeight))
}

/** Padding as one shorthand, or the one side that has any. */
function padding(w: Writer): void {
  const { node } = w
  const sides = [
    ['paddingTop', node.paddingTop],
    ['paddingRight', node.paddingRight],
    ['paddingBottom', node.paddingBottom],
    ['paddingLeft', node.paddingLeft]
  ] as const
  const set = sides.filter(([field, value]) => value !== 0 || node.boundVariables[field])
  if (set.length === 0) return
  if (set.length === 1) {
    const [field, value] = set[0]
    w.set(`padding-${field.slice('padding'.length).toLowerCase()}`, w.length(field, value))
    return
  }
  const [top, right, bottom, left] = sides.map(([field, value]) => w.length(field, value, '0'))
  if (top === bottom && right === left) w.set('padding', top === right ? top : `${top} ${right}`)
  else w.set('padding', `${top} ${right} ${bottom} ${left}`)
}

/** A frame whose width hugs its content flows inline, as Dev Mode writes it. */
function autoLayout(w: Writer): void {
  w.set('display', hugs(w.node, 'width') ? 'inline-flex' : 'flex')
}

function autoLayoutFlow(w: Writer): void {
  const { node } = w
  padding(w)
  if (node.layoutMode === 'VERTICAL') w.set('flex-direction', 'column')
  w.set('justify-content', JUSTIFY[node.primaryAxisAlign])
  const wraps = node.layoutWrap === 'WRAP'
  w.set('align-items', wraps ? 'flex-start' : ALIGN[node.counterAxisAlign])
  if (node.primaryAxisAlign !== 'SPACE_BETWEEN') {
    const item =
      node.itemSpacing !== 0 || node.boundVariables.itemSpacing
        ? w.length('itemSpacing', node.itemSpacing)
        : null
    const counter = wraps ? w.length('counterAxisSpacing', node.counterAxisSpacing) : null
    w.set('gap', counter && item ? `${counter} ${item}` : item)
  }
  if (wraps) w.set('flex-wrap', 'wrap')
}

/** What a layer in auto layout takes from it: growing, stretching, or its own place. */
function placement(w: Writer, parent: SceneNode | undefined): void {
  const { node } = w
  if (!isAutoLayout(parent)) return
  if (node.layoutPositioning === 'ABSOLUTE') {
    w.set('position', 'absolute')
    w.set('left', px(node.x))
    w.set('top', px(node.y))
    return
  }
  if (node.layoutGrow > 0) w.set('flex', '1 0 0')
  if (node.layoutAlignSelf === 'STRETCH') w.set('align-self', 'stretch')
}

function radius(w: Writer): void {
  const { node } = w
  const corners = [
    ['topLeftRadius', node.topLeftRadius],
    ['topRightRadius', node.topRightRadius],
    ['bottomRightRadius', node.bottomRightRadius],
    ['bottomLeftRadius', node.bottomLeftRadius]
  ] as const
  const bound = corners.some(([field]) => node.boundVariables[field])
  if (!node.independentCorners && !bound) {
    if (node.cornerRadius > 0) w.set('border-radius', w.length('cornerRadius', node.cornerRadius))
    return
  }
  const values = corners.map(([field, value]) =>
    w.length(field, node.independentCorners ? value : node.cornerRadius, '0')
  )
  if (values.every((value) => value === '0')) return
  w.set(
    'border-radius',
    values.every((value) => value === values[0]) ? values[0] : values.join(' ')
  )
}

function border(w: Writer): void {
  const { graph, node } = w
  const color = solidColorCSS(graph, node, 'strokes')
  if (!color) return
  const style = node.dashPattern.length > 0 ? 'dashed' : 'solid'
  if (!node.independentStrokeWeights) {
    if (node.strokeWeight > 0) w.set('border', `${px(node.strokeWeight)} ${style} ${color}`)
    return
  }
  const sides = [
    ['top', node.borderTopWeight],
    ['right', node.borderRightWeight],
    ['bottom', node.borderBottomWeight],
    ['left', node.borderLeftWeight]
  ] as const
  for (const [side, weight] of sides) {
    if (weight > 0) w.set(`border-${side}`, `${px(weight)} ${style} ${color}`)
  }
}

function effects(w: Writer): void {
  const visible = w.node.effects.filter((effect) => effect.visible)
  const shadows = visible.flatMap((effect) => {
    if (effect.type !== 'DROP_SHADOW' && effect.type !== 'INNER_SHADOW') return []
    const parts = [effect.offset.x, effect.offset.y, effect.radius, effect.spread].map((value) =>
      px(value, '0')
    )
    const inset = effect.type === 'INNER_SHADOW' ? ' inset' : ''
    return [`${parts.join(' ')} ${cssColor(effect.color)}${inset}`]
  })
  w.set('box-shadow', shadows.length > 0 ? shadows.join(', ') : null)
  for (const effect of visible) {
    // Dev Mode writes a blur at half its radius, as CSS's blur takes a deviation.
    if (effect.type === 'LAYER_BLUR') w.set('filter', `blur(${px(effect.radius / 2)})`)
    if (effect.type === 'BACKGROUND_BLUR')
      w.set('backdrop-filter', `blur(${px(effect.radius / 2)})`)
  }
}

function blending(w: Writer): void {
  const { node } = w
  if (node.blendMode === 'NORMAL' || node.blendMode === 'PASS_THROUGH') return
  w.set('mix-blend-mode', node.blendMode.toLowerCase().replaceAll('_', '-'))
}

function text(w: Writer): void {
  const { graph, node } = w
  w.set('color', solidColorCSS(graph, node, 'fills'))
  w.set('text-align', TEXT_ALIGN[node.textAlignHorizontal])
  w.set('font-family', node.fontFamily)
  w.set('font-size', px(node.fontSize))
  w.set('font-style', node.italic ? 'italic' : 'normal')
  w.set('font-weight', String(node.fontWeight))
  const line = node.lineHeight
  if (!line) w.set('line-height', 'normal')
  else {
    const pixels = line.unit === 'PIXELS' ? line.value : (line.value / 100) * node.fontSize
    w.set('line-height', `${px(pixels)} /* ${cssNumber((pixels / node.fontSize) * 100)}% */`)
  }
  const spacing = node.letterSpacing
  const tracking = spacing.unit === 'PIXELS' ? spacing.value : (spacing.value / 100) * node.fontSize
  if (tracking !== 0) w.set('letter-spacing', px(tracking))
  if (node.textDecoration !== 'NONE') {
    w.set(
      'text-decoration-line',
      node.textDecoration === 'UNDERLINE' ? 'underline' : 'line-through'
    )
    w.set('text-decoration-style', 'solid')
    w.set('text-decoration-skip-ink', 'auto')
    w.set('text-decoration-thickness', 'auto')
    w.set('text-underline-offset', 'auto')
    w.set('text-underline-position', 'from-font')
  }
  w.set('text-transform', TEXT_TRANSFORM[node.textCase])
}

/** A line's stroke drawn as the box CSS has for it. */
function line(w: Writer): void {
  const { graph, node } = w
  w.set('width', px(node.width))
  w.set('height', px(node.strokeWeight))
  w.set('background', solidColorCSS(graph, node, 'strokes'))
}

/** A layer's CSS as Dev Mode gives it: an empty record for pages and the document. */
export function layerCSS(graph: SceneGraph, layer: SceneNode): Record<string, string> {
  if (layer.type === 'CANVAS' || layer.id === graph.rootId) return {}
  // Bound colours are written with the value their variable resolves to.
  const node = { ...layer, ...resolvedPaintBindings(graph, layer) }
  const w = new Writer(graph, node)
  const parent = parentOf(graph, node)
  if (node.type === 'LINE') {
    line(w)
    return Object.fromEntries(w.list)
  }
  if (node.type === 'GROUP' || node.type === 'SECTION') {
    w.set('width', px(node.width))
    w.set('height', px(node.height))
    return Object.fromEntries(w.list)
  }
  if (node.type === 'TEXT') {
    placement(w, parent)
    text(w)
    return Object.fromEntries(w.list)
  }
  if (isAutoLayout(node)) autoLayout(w)
  size(w, parent)
  placement(w, parent)
  if (isAutoLayout(node)) autoLayoutFlow(w)
  if (node.rotation !== 0) w.set('transform', `rotate(${cssNumber(node.rotation)}deg)`)
  radius(w)
  if (SVG_SHAPES.has(node.type)) {
    if (node.opacity < 1) w.set('opacity', cssNumber(node.opacity))
    w.set('fill', solidColorCSS(graph, node, 'fills'))
    if (node.strokeWeight > 0 && solidColorCSS(graph, node, 'strokes')) {
      w.set('stroke-width', px(node.strokeWeight))
      w.set('stroke', solidColorCSS(graph, node, 'strokes'))
    }
  } else {
    border(w)
    if (node.opacity < 1) w.set('opacity', cssNumber(node.opacity))
    w.set('background', backgroundCSS(graph, node))
  }
  blending(w)
  effects(w)
  return Object.fromEntries(w.list)
}
