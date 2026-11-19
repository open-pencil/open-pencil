import { pick } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  parseCSSAlignItems,
  parseCSSFlexDirection,
  parseCSSJustifyContent,
  parseCSSNumber,
  splitCSSValue
} from '@open-pencil/scene-graph/css'
import {
  autoLayoutSizingFields,
  fillSizingFields,
  layoutSizing,
  layoutSizingUpdates,
  textAutoResizeFor
} from '@open-pencil/scene-graph/layout'

import type { DesignElement, DesignNode, DesignStyleDeclaration } from '../types'
import { mergedStyle, pickStyle } from './css-values'
import { isTableRow } from './table'

/**
 * How CSS lays an element and its children out, mapped onto auto layout: block flow stacks
 * children vertically and stretches block-level ones across, a flex container is a stack in its
 * direction that stretches items across by default, and inline-level content hugs.
 */
export type FlowKind = 'block' | 'flex' | 'inline'

/** The layout a child is placed in: its parent's flow, or none at the top of the page. */
export type ParentFlow = FlowKind | 'none'

/** Tags browsers lay out in a line by default. */
export const INLINE_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'code',
  'del',
  'em',
  'i',
  'ins',
  'kbd',
  'label',
  'mark',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'u'
])
const INLINE_BLOCK_TAGS = new Set(['button', 'img', 'input', 'select', 'textarea'])
/** Elements browsers center their content in both ways, beyond what their styles say. */
const CENTERED_TAGS = new Set(['button'])

/** What a run of text takes from its element: the properties CSS inherits, and decoration. */
const TEXT_PROPERTIES = [
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'line-height',
  'text-align',
  'text-decoration-line',
  'text-shadow',
  'text-transform',
  'text-wrap-mode',
  'white-space'
]

/**
 * The style a run of text directly inside an element takes from it. The element's own box,
 * position, and opacity stay on the element, so the text is neither placed nor faded twice.
 */
export function inheritedTextStyle(style: DesignStyleDeclaration): DesignStyleDeclaration {
  return pick(style, TEXT_PROPERTIES)
}

/** The element's `display`, or the one browsers give its tag by default. */
export function elementDisplay(element: DesignElement, style: DesignStyleDeclaration): string {
  const display = pickStyle(style, 'display')?.trim().toLowerCase()
  if (display) return display
  const tag = element.tagName.toLowerCase()
  // Generated content, `::before` and `::after`, is inline unless styled otherwise, as in CSS.
  if (INLINE_TAGS.has(tag) || tag.startsWith('::')) return 'inline'
  if (tag === 'li') return 'list-item'
  return INLINE_BLOCK_TAGS.has(tag) ? 'inline-block' : 'block'
}

/**
 * The flow an element lays its own children out in. An `inline-block` sits in a line but holds
 * a block of its own, so only a plain `inline` element lays its children out in a line.
 */
export function flowOf(display: string): FlowKind {
  if (display === 'flex' || display === 'inline-flex' || isTableRow(display)) return 'flex'
  return display === 'inline' ? 'inline' : 'block'
}

/** Whether the element sits in a line rather than on its own row, so it hugs its content. */
export function isInlineLevel(display: string): boolean {
  return display.startsWith('inline')
}

/**
 * The legacy `text-align` values `<center>` and the `align` attribute compute to, which align a
 * block's children as well as its lines, by the side they put them on.
 */
const LEGACY_TEXT_ALIGN: Partial<Record<string, 'left' | 'center' | 'right'>> = {
  '-moz-left': 'left',
  '-webkit-left': 'left',
  '-moz-center': 'center',
  '-webkit-center': 'center',
  '-moz-right': 'right',
  '-webkit-right': 'right'
}

/** The element's `text-align`, lowercase, with a legacy value read as the side it aligns to. */
export function textAlignOf(style: DesignStyleDeclaration): string | undefined {
  const align = pickStyle(style, 'text-align')?.trim().toLowerCase()
  return align === undefined ? undefined : (LEGACY_TEXT_ALIGN[align] ?? align)
}

function textAlignAxis(style: DesignStyleDeclaration) {
  const align = textAlignOf(style)
  if (align === 'center') return 'CENTER'
  return align === 'right' || align === 'end' ? 'MAX' : 'MIN'
}

/** Where a block can go across its container besides its start. */
type BlockAlign = 'CENTER' | 'MAX'

const BLOCK_ALIGN: Partial<Record<string, BlockAlign>> = { center: 'CENTER', right: 'MAX' }

/**
 * Where block flow puts a block across its container: by its auto margins, which take up the
 * space it leaves, or else by a legacy `text-align` on the container, as `<center>` sets.
 */
function blockAlignSelf(
  style: DesignStyleDeclaration,
  containerStyle: DesignStyleDeclaration
): BlockAlign | null {
  const left = pickStyle(style, 'margin-left')?.trim() === 'auto'
  const right = pickStyle(style, 'margin-right')?.trim() === 'auto'
  if (left && right) return 'CENTER'
  if (left) return 'MAX'
  if (right) return null
  const legacy = pickStyle(containerStyle, 'text-align')?.trim().toLowerCase() ?? ''
  const side = LEGACY_TEXT_ALIGN[legacy]
  return side ? (BLOCK_ALIGN[side] ?? null) : null
}

/** A child element's layer, with the element and its style. */
export interface FlowBlock {
  layer: SceneNode
  element: DesignElement
  style: DesignStyleDeclaration
}

/**
 * Aligns blocks in their block-flow container where CSS centers them or puts them at the end, as
 * `margin: auto` and `<center>` do. A block that fills the container's width has no room to
 * move, so only one with a width of its own moves by its own alignment. One capped by a maximum
 * width stays filling up to it, and the container's alignment places it, as Figma places a
 * capped Fill child, when that moves nothing else: when every other child fills the width
 * without a maximum of its own.
 * Otherwise it hugs its content up to the maximum, and placement corrects a size that differs.
 */
export function alignBlocksInFlow(
  graph: SceneGraph,
  container: SceneNode,
  blocks: readonly FlowBlock[],
  containerStyle: DesignStyleDeclaration
): void {
  const capped: { layer: SceneNode; align: BlockAlign }[] = []
  for (const { layer, style } of blocks) {
    if (layer.layoutPositioning === 'ABSOLUTE') continue
    const align = blockAlignSelf(style, containerStyle)
    if (!align) continue
    if (layer.layoutAlignSelf !== 'STRETCH') layer.layoutAlignSelf = align
    else if (layer.maxWidth !== null) capped.push({ layer, align })
  }
  if (capped.length === 0) return
  const [{ align }] = capped
  const cappedIds = new Set(capped.map((block) => block.layer.id))
  const othersFill = graph
    .getChildren(container.id)
    .filter((child) => child.layoutPositioning !== 'ABSOLUTE' && !cappedIds.has(child.id))
    // A sibling capped by a maximum width of its own would move with the container's alignment.
    .every((child) => child.layoutAlignSelf === 'STRETCH' && child.maxWidth === null)
  if (othersFill && capped.every((block) => block.align === align)) {
    container.counterAxisAlign = align
    return
  }
  for (const { layer, align: own } of capped) {
    Object.assign(layer, layoutSizingUpdates(graph, layer, 'HORIZONTAL', 'HUG'))
    layer.layoutAlignSelf = own
  }
}

const LINE_ALIGN: Partial<Record<SceneNode['textAlignHorizontal'], SceneNode['counterAxisAlign']>> =
  {
    CENTER: 'CENTER',
    RIGHT: 'MAX'
  }

/**
 * Aligns a block's lines across it, as `text-align` does, when they are all it holds: a single
 * line hugs its words, and an inline-level box, such as an inline-block, its content, so the
 * block places them where the page did. Text takes its own alignment, which a block element that
 * became a text layer may set; boxes in a line take the block's. `text-align` moves lines, not
 * blocks, so a block with a block-level child keeps its children at its start.
 */
export function alignBlockLines(
  graph: SceneGraph,
  node: SceneNode,
  style: DesignStyleDeclaration,
  inlineContent: boolean
): void {
  if (node.layoutMode !== 'VERTICAL') return
  const children = graph.getChildren(node.id)
  if (children.length === 0) return
  if (children.every((child) => child.type === 'TEXT')) {
    const [first] = children
    if (!children.every((child) => child.textAlignHorizontal === first.textAlignHorizontal)) return
    const align = LINE_ALIGN[first.textAlignHorizontal]
    if (align) node.counterAxisAlign = align
    return
  }
  if (inlineContent) node.counterAxisAlign = textAlignAxis(style)
}

/** The auto layout an element's own flow gives its children. */
export function applyContainerLayout(
  node: SceneNode,
  element: DesignElement,
  style: DesignStyleDeclaration,
  flow: FlowKind
): void {
  if (flow === 'flex') {
    node.layoutMode = parseCSSFlexDirection(pickStyle(style, 'flex-direction')) ?? 'HORIZONTAL'
    node.primaryAxisAlign = parseCSSJustifyContent(pickStyle(style, 'justify-content')) ?? 'MIN'
    // Flex items stretch across the container unless `align-items` says otherwise.
    node.counterAxisAlign = parseCSSAlignItems(pickStyle(style, 'align-items')) ?? 'STRETCH'
    node.layoutWrap = pickStyle(style, 'flex-wrap') === 'wrap' ? 'WRAP' : 'NO_WRAP'
    return
  }
  if (flow === 'block') {
    node.layoutMode = 'VERTICAL'
    // Browsers center a button's content both ways.
    if (CENTERED_TAGS.has(element.tagName.toLowerCase())) {
      node.primaryAxisAlign = 'CENTER'
      node.counterAxisAlign = 'CENTER'
    }
    return
  }
  // Inline content runs in a line, aligned by `text-align`.
  node.layoutMode = 'HORIZONTAL'
  node.primaryAxisAlign = textAlignAxis(style)
  node.counterAxisAlign = 'CENTER'
}

function grows(style: DesignStyleDeclaration): boolean {
  const grow = parseCSSNumber(pickStyle(style, 'flex-grow'))
  if (grow !== null) return grow > 0
  const [flex] = splitCSSValue(pickStyle(style, 'flex') ?? '')
  if (flex === 'auto') return true
  const shorthand = parseCSSNumber(flex)
  return shorthand !== null && shorthand > 0
}

function isFullSize(style: DesignStyleDeclaration, property: 'width' | 'height'): boolean {
  return pickStyle(style, property)?.trim() === '100%'
}

interface BoxSize {
  fixedWidth: boolean
  fixedHeight: boolean
}

/** Fill from the parent's flow: block children across, growing items along, `100%` either way. */
function applyParentFill(
  graph: SceneGraph,
  node: SceneNode,
  style: DesignStyleDeclaration,
  display: string,
  parentFlow: ParentFlow,
  { fixedWidth, fixedHeight }: BoxSize
): void {
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  const parentLayout = parent?.layoutMode ?? 'NONE'
  if (!parent || parentLayout === 'NONE' || node.layoutPositioning === 'ABSOLUTE') return
  const fill = (axis: 'HORIZONTAL' | 'VERTICAL') =>
    Object.assign(node, fillSizingFields(parentLayout, axis))
  const mainAxis = parentLayout === 'VERTICAL' ? 'VERTICAL' : 'HORIZONTAL'
  // A box sized to its content, as an inline-block, a flex item, or an absolute box is, has no
  // width of its own for block children to fill; they size it instead.
  const block = parentFlow === 'block' && !isInlineLevel(display) && !fixedWidth
  if (block && hasDefiniteWidth(graph, parent)) fill('HORIZONTAL')
  if (parentFlow === 'flex' && grows(style)) fill(mainAxis)
  if (isFullSize(style, 'width')) fill('HORIZONTAL')
  if (isFullSize(style, 'height')) fill('VERTICAL')
  if (parentFlow === 'flex') keepFixedCrossSize(node, parent, mainAxis, { fixedWidth, fixedHeight })
}

/** An item with its own cross size keeps it in a stretching flex container, as in CSS. */
function keepFixedCrossSize(
  node: SceneNode,
  parent: SceneNode,
  mainAxis: 'HORIZONTAL' | 'VERTICAL',
  { fixedWidth, fixedHeight }: BoxSize
): void {
  const crossFixed = mainAxis === 'VERTICAL' ? fixedWidth : fixedHeight
  const inheritsStretch = node.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH'
  if (crossFixed && inheritsStretch) node.layoutAlignSelf = 'MIN'
}

function hasDefiniteWidth(graph: SceneGraph, node: SceneNode): boolean {
  return layoutSizing(graph, node, 'HORIZONTAL') !== 'HUG'
}

/** White space values that break lines only where the text does, never to fit a width. */
const UNWRAPPED_WHITE_SPACE = new Set(['nowrap', 'pre'])

/** Whether CSS keeps text's lines as the text breaks them, however narrow its box. */
function keepsLines(style: DesignStyleDeclaration): boolean {
  const whiteSpace = pickStyle(style, 'white-space')
  return (
    (whiteSpace !== undefined && UNWRAPPED_WHITE_SPACE.has(whiteSpace)) ||
    pickStyle(style, 'text-wrap-mode') === 'nowrap'
  )
}

/**
 * Text wraps where its width is fixed or fills a parent with a width of its own, and hugs its
 * content otherwise, as text that CSS does not wrap always does. It is measured when the
 * document is laid out.
 */
function applyTextSizing(
  graph: SceneGraph,
  node: SceneNode,
  style: DesignStyleDeclaration,
  size: BoxSize
): void {
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  const fillsWidth =
    parent !== undefined &&
    hasDefiniteWidth(graph, parent) &&
    layoutSizing(graph, node, 'HORIZONTAL') === 'FILL'
  const wraps = (size.fixedWidth || fillsWidth) && !keepsLines(style)
  node.textAutoResize = wraps ? textAutoResizeFor(false, !size.fixedHeight) : 'WIDTH_AND_HEIGHT'
  // Wrapping text starts at its content's width.
  if (!size.fixedWidth) node.width = 0
  if (!size.fixedHeight) node.height = 0
}

/**
 * How a child sizes in its parent's flow, as CSS sizes it: an explicit size is fixed, block-level
 * children of block flow and items of a stretching flex container fill across, a growing flex
 * item fills along, `100%` fills, and everything else hugs. Text that fills its width wraps.
 */
export function applyFlowSizing(
  graph: SceneGraph,
  node: SceneNode,
  style: DesignStyleDeclaration,
  display: string,
  parentFlow: ParentFlow
): void {
  const size: BoxSize = {
    fixedWidth: parseCSSNumber(pickStyle(style, 'width')) !== null,
    fixedHeight: parseCSSNumber(pickStyle(style, 'height')) !== null
  }
  if (node.layoutMode !== 'NONE' && node.layoutMode !== 'GRID') {
    const own = (fixed: boolean) => (fixed ? 'FIXED' : 'HUG')
    Object.assign(
      node,
      autoLayoutSizingFields(node.layoutMode, own(size.fixedWidth), own(size.fixedHeight))
    )
  }
  applyParentFill(graph, node, style, display, parentFlow, size)
  if (node.type === 'TEXT') applyTextSizing(graph, node, style, size)
}

/** Whether a box is out of the flow, placed by its own position rather than in the lines. */
function isOutOfFlow(node: DesignNode): boolean {
  if (node.type !== 'element') return false
  const position = pickStyle(mergedStyle(node), 'position')?.trim()
  return position === 'absolute' || position === 'fixed'
}

/**
 * An element's content as its lines lay it out, and the boxes out of the flow inside it, such as a
 * link's `::before` stretched over the card it is in, which take no part in the lines.
 */
export function splitOutOfFlow(element: DesignElement): {
  inFlow: DesignElement
  outOfFlow: DesignElement[]
} {
  const outOfFlow: DesignElement[] = []
  const keep = (node: DesignElement): DesignElement => ({
    ...node,
    children: node.children.flatMap((child): DesignNode[] => {
      if (child.type !== 'element') return [child]
      if (isOutOfFlow(child)) {
        outOfFlow.push(child)
        return []
      }
      return [keep(child)]
    })
  })
  return { inFlow: keep(element), outOfFlow }
}

function hidesByVisibility(node: DesignElement): boolean {
  const visibility = pickStyle(mergedStyle(node), 'visibility')?.trim()
  return visibility === 'hidden' || visibility === 'collapse'
}

/**
 * How much of a box CSS hides with `visibility`: `all` of it, `own` paint only when a descendant
 * sets `visibility: visible` and shows inside it, which a hidden layer would hide with it, or
 * `none`.
 */
export function hiddenPart(element: DesignElement): 'all' | 'own' | 'none' {
  if (!hidesByVisibility(element)) return 'none'
  const showsAgain = (node: DesignElement): boolean =>
    node.children.some(
      (child) => child.type === 'element' && (!hidesByVisibility(child) || showsAgain(child))
    )
  return showsAgain(element) ? 'own' : 'all'
}
