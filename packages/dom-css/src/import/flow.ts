import {
  autoLayoutSizingFields,
  fillSizingFields,
  layoutSizing,
  textAutoResizeFor,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import {
  parseCSSAlignItems,
  parseCSSFlexDirection,
  parseCSSJustifyContent,
  parseCSSNumber
} from '@open-pencil/scene-graph/css'

import type { DesignElement, DesignStyleDeclaration } from '../types'
import { pickStyle } from './css-values'

/**
 * How CSS lays an element and its children out, mapped onto auto layout: block flow stacks
 * children vertically and stretches block-level ones across, a flex container is a stack in its
 * direction that stretches items across by default, and inline-level content hugs.
 */
export type FlowKind = 'block' | 'flex' | 'inline'

/** The layout a child is placed in: its parent's flow, or none at the top of the page. */
export type ParentFlow = FlowKind | 'none'

const INLINE_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'code',
  'em',
  'i',
  'kbd',
  'label',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'u'
])
const INLINE_BLOCK_TAGS = new Set(['button', 'img', 'input', 'select', 'textarea'])
/** Elements browsers center their text in by default. */
const CENTERED_TAGS = new Set(['button'])

/** The element's `display`, or the one browsers give its tag by default. */
export function elementDisplay(element: DesignElement, style: DesignStyleDeclaration): string {
  const display = pickStyle(style, 'display')?.trim().toLowerCase()
  if (display) return display
  const tag = element.tagName.toLowerCase()
  if (INLINE_TAGS.has(tag)) return 'inline'
  return INLINE_BLOCK_TAGS.has(tag) ? 'inline-block' : 'block'
}

export function flowOf(display: string): FlowKind {
  if (display === 'flex' || display === 'inline-flex') return 'flex'
  return display.startsWith('inline') ? 'inline' : 'block'
}

/** Whether the element sits in a line rather than on its own row, so it hugs its content. */
export function isInlineLevel(display: string): boolean {
  return display.startsWith('inline')
}

function textAlignAxis(element: DesignElement, style: DesignStyleDeclaration) {
  const align = pickStyle(style, 'text-align')?.trim().toLowerCase()
  if (align === 'center') return 'CENTER'
  if (align === 'right' || align === 'end') return 'MAX'
  if (align) return 'MIN'
  return CENTERED_TAGS.has(element.tagName.toLowerCase()) ? 'CENTER' : 'MIN'
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
    return
  }
  // Inline content runs in a line, aligned by `text-align`.
  node.layoutMode = 'HORIZONTAL'
  node.primaryAxisAlign = textAlignAxis(element, style)
  node.counterAxisAlign = 'CENTER'
}

function grows(style: DesignStyleDeclaration): boolean {
  const grow = parseCSSNumber(pickStyle(style, 'flex-grow'))
  if (grow !== null) return grow > 0
  const flex = pickStyle(style, 'flex')?.trim().split(/\s+/)[0]
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
  if (parentFlow === 'block' && !isInlineLevel(display) && !fixedWidth) fill('HORIZONTAL')
  if (parentFlow === 'flex' && grows(style)) fill(mainAxis)
  if (isFullSize(style, 'width')) fill('HORIZONTAL')
  if (isFullSize(style, 'height')) fill('VERTICAL')
  // An item with its own cross size keeps it in a stretching container, as in CSS.
  const crossFixed = mainAxis === 'VERTICAL' ? fixedWidth : fixedHeight
  const inheritsStretch = node.layoutAlignSelf === 'AUTO' && parent.counterAxisAlign === 'STRETCH'
  if (parentFlow === 'flex' && crossFixed && inheritsStretch) node.layoutAlignSelf = 'MIN'
}

/** Text hugs the axes it does not fill or fix, and is measured when the document is laid out. */
function applyTextSizing(graph: SceneGraph, node: SceneNode, size: BoxSize): void {
  const hugs = (axis: 'HORIZONTAL' | 'VERTICAL') => layoutSizing(graph, node, axis) !== 'FILL'
  node.textAutoResize = textAutoResizeFor(
    !size.fixedWidth && hugs('HORIZONTAL'),
    !size.fixedHeight && hugs('VERTICAL')
  )
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
  if (node.type === 'TEXT') applyTextSizing(graph, node, size)
}
