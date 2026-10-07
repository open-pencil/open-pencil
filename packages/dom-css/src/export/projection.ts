import { fromUint8Array } from 'js-base64'

import { layoutSizingInParent, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { BLACK } from '@open-pencil/scene-graph/constants'
import { resolveNodeTextDirection } from '@open-pencil/scene-graph/text-direction'

import { DesignTokens, type CSSModes } from '../tokens/references'
import type { DesignDocument, DesignNode, DesignStyleDeclaration } from '../types'
import { cssColor, dropShadowToCSS, effectsToCSS, fillToCSS, strokeColorToCSS } from './css'
import { addGridContainer, addGridPlacement } from './grid'

const DOM_CSS_PLUGIN_ID = 'open-pencil-dom-css'
const IMAGE_SOURCE_URL_KEY = 'image-source-url'

export interface SceneGraphToDesignOptions {
  rootId?: string
  includeSourceIds?: boolean
  /** Write variable-bound values as `var(--name)` where CSS resolves them as drawn. Default true. */
  tokens?: boolean
}

/** A field's CSS: its token reference where one is faithful, otherwise the literal value. */
type FieldCSS = (field: string, literal: string) => string

const px = (value: number) => `${value}px`

function nodeChildren(graph: SceneGraph, node: SceneNode): SceneNode[] {
  return node.childIds
    .map((id) => graph.getNode(id))
    .filter((child): child is SceneNode => child !== undefined)
}

function justifyContentToCSS(value: SceneNode['primaryAxisAlign']): string | undefined {
  if (value === 'CENTER') return 'center'
  if (value === 'MAX') return 'flex-end'
  if (value === 'SPACE_BETWEEN') return 'space-between'
  return undefined
}

/**
 * Cross-axis alignment of a container's children, or of one child. Auto layout starts children
 * at the start while flexbox stretches them, so start is written out: a child that hugs its
 * content keeps its own size.
 */
function alignToCSS(
  value: SceneNode['counterAxisAlign'] | SceneNode['layoutAlignSelf']
): string | undefined {
  if (value === 'MIN') return 'flex-start'
  if (value === 'CENTER') return 'center'
  if (value === 'MAX') return 'flex-end'
  if (value === 'STRETCH') return 'stretch'
  if (value === 'BASELINE') return 'baseline'
  return undefined
}

function textCaseToCSS(value: SceneNode['textCase']): string | undefined {
  if (value === 'UPPER') return 'uppercase'
  if (value === 'LOWER') return 'lowercase'
  if (value === 'TITLE') return 'capitalize'
  return undefined
}

/** Whether a layer sizes itself to its content along an axis, so CSS should too. */
function hugs(node: SceneNode, axis: 'width' | 'height'): boolean {
  if (node.type === 'TEXT')
    return (
      node.textAutoResize === 'WIDTH_AND_HEIGHT' ||
      (axis === 'height' && node.textAutoResize === 'HEIGHT')
    )
  if (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL') return false
  const primary = (node.layoutMode === 'HORIZONTAL') === (axis === 'width')
  return (primary ? node.primaryAxisSizing : node.counterAxisSizing) === 'HUG'
}

/**
 * A layer's size: fixed on the axes the design fixes, and left to the content where the layer
 * hugs it (an auto layout frame set to Hug, or auto-sizing text), so the page grows with it.
 */
function addSize(
  style: DesignStyleDeclaration,
  node: SceneNode,
  parent: SceneNode | undefined,
  css: FieldCSS
): void {
  const sized = (axis: 'width' | 'height') =>
    node[axis] > 0 && !hugs(node, axis) && !stretches(node, parent, axis)
  if (sized('width')) style.width = css('width', px(node.width))
  if (sized('height')) style.height = css('height', px(node.height))
}

/**
 * Whether a layer fills an axis by stretching, which a fixed CSS size would prevent: across a
 * flex parent, or either axis of a grid cell. Along a flex parent, fill is `flex-grow`, and the
 * size stays as its basis.
 */
function stretches(
  node: SceneNode,
  parent: SceneNode | undefined,
  axis: 'width' | 'height'
): boolean {
  const sizing = layoutSizingInParent(parent, node, axis === 'width' ? 'HORIZONTAL' : 'VERTICAL')
  if (sizing !== 'FILL' || !parent) return false
  if (parent.layoutMode === 'GRID') return true
  const mainAxis = parent.layoutMode === 'HORIZONTAL' ? 'width' : 'height'
  return axis !== mainAxis
}

/**
 * Place a layer at its coordinates when its parent does not lay it out: it is absolutely
 * positioned, or its parent frame has no auto layout. A frame without auto layout becomes the
 * containing block of the children it places.
 */
function addPositioning(
  style: DesignStyleDeclaration,
  node: SceneNode,
  parent: SceneNode | undefined
): void {
  const placed =
    node.layoutPositioning === 'ABSOLUTE' ||
    (parent !== undefined && parent.type !== 'CANVAS' && parent.layoutMode === 'NONE')
  if (placed) {
    style.position = 'absolute'
    style.left = `${node.x}px`
    style.top = `${node.y}px`
  } else if (node.layoutMode === 'NONE' && node.type !== 'TEXT' && node.childIds.length > 0) {
    style.position = 'relative'
  }
}

function addSizeConstraints(style: DesignStyleDeclaration, node: SceneNode, css: FieldCSS): void {
  if (node.minWidth !== null) style['min-width'] = css('minWidth', px(node.minWidth))
  if (node.maxWidth !== null) style['max-width'] = css('maxWidth', px(node.maxWidth))
  if (node.minHeight !== null) style['min-height'] = css('minHeight', px(node.minHeight))
  if (node.maxHeight !== null) style['max-height'] = css('maxHeight', px(node.maxHeight))
}

function addCornerRadii(style: DesignStyleDeclaration, node: SceneNode, css: FieldCSS): void {
  if (node.type === 'ELLIPSE') {
    style['border-radius'] = '50%'
    return
  }
  if (node.independentCorners) {
    const corners = [
      ['border-top-left-radius', 'topLeftRadius', node.topLeftRadius],
      ['border-top-right-radius', 'topRightRadius', node.topRightRadius],
      ['border-bottom-right-radius', 'bottomRightRadius', node.bottomRightRadius],
      ['border-bottom-left-radius', 'bottomLeftRadius', node.bottomLeftRadius]
    ] as const
    for (const [property, field, radius] of corners)
      if (radius > 0) style[property] = css(field, px(radius))
    return
  }

  if (node.cornerRadius > 0) style['border-radius'] = css('cornerRadius', px(node.cornerRadius))
}

function addStroke(style: DesignStyleDeclaration, node: SceneNode, css: FieldCSS): void {
  const stroke = node.strokes.at(0)
  const literalColor = strokeColorToCSS(stroke)
  if (!literalColor || !stroke) return
  const color = css('strokes/0/color', literalColor)
  const borderStyle = node.dashPattern.length > 0 ? 'dashed' : 'solid'
  if (!node.independentStrokeWeights) {
    style.border = `${css('strokeWeight', px(stroke.weight))} solid ${color}`
    if (borderStyle !== 'solid') style['border-style'] = borderStyle
    return
  }

  style['border-style'] = borderStyle
  style['border-color'] = color
  style['border-top-width'] = css('borderTopWeight', px(node.borderTopWeight))
  style['border-right-width'] = css('borderRightWeight', px(node.borderRightWeight))
  style['border-bottom-width'] = css('borderBottomWeight', px(node.borderBottomWeight))
  style['border-left-width'] = css('borderLeftWeight', px(node.borderLeftWeight))
}

const PADDING_FIELDS = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const

/** Sides compare by their CSS, so a token and a literal of the same size stay separate. */
function addPadding(style: DesignStyleDeclaration, node: SceneNode, css: FieldCSS): void {
  const [top, right, bottom, left] = PADDING_FIELDS.map((field) => css(field, px(node[field])))
  const zero = px(0)
  if ([top, right, bottom, left].every((value) => value === zero)) return

  if (top === right && right === bottom && bottom === left) {
    style.padding = top
    return
  }

  if (top === bottom && right === left) {
    if (top !== zero) style['padding-block'] = top
    if (right !== zero) style['padding-inline'] = right
    return
  }

  if (top !== zero) style['padding-top'] = top
  if (right !== zero) style['padding-right'] = right
  if (bottom !== zero) style['padding-bottom'] = bottom
  if (left !== zero) style['padding-left'] = left
}

function addFlexGap(style: DesignStyleDeclaration, node: SceneNode, css: FieldCSS): void {
  if (node.itemSpacing <= 0 && node.counterAxisSpacing <= 0) return
  const item = css('itemSpacing', px(node.itemSpacing))
  if (node.counterAxisSpacing <= 0) {
    style.gap = item
    return
  }

  const counter = css('counterAxisSpacing', px(node.counterAxisSpacing))
  if (node.layoutMode === 'HORIZONTAL') {
    if (node.itemSpacing > 0) style['column-gap'] = item
    style['row-gap'] = counter
    return
  }

  if (node.itemSpacing > 0) style['row-gap'] = item
  style['column-gap'] = counter
}

function addImageStyle(style: DesignStyleDeclaration, node: SceneNode): void {
  const fill = node.fills.at(0)
  if (fill?.type !== 'IMAGE' || !fill.visible) return
  if (node.width > 0 && node.height > 0) style['aspect-ratio'] = `${node.width} / ${node.height}`
  if (fill.imageScaleMode === 'FIT') style['object-fit'] = 'contain'
  if (fill.imageScaleMode === 'FILL') style['object-fit'] = 'cover'
}

/** Styles a node takes from its parent's layout, and its own rotation. */
function addLayoutChild(
  style: DesignStyleDeclaration,
  node: SceneNode,
  parent: SceneNode | undefined
): void {
  if (parent?.layoutMode === 'GRID') addGridPlacement(style, node)
  else if (parent && parent.layoutMode !== 'NONE' && node.layoutGrow > 0) style['flex-grow'] = '1'
  if (node.rotation !== 0) style.transform = `rotate(${node.rotation}deg)`
}

function styleFromSceneNode(
  node: SceneNode,
  parent: SceneNode | undefined,
  css: FieldCSS
): DesignStyleDeclaration {
  const style: DesignStyleDeclaration = {}
  addSize(style, node, parent, css)
  addPositioning(style, node, parent)
  addSizeConstraints(style, node, css)
  const fill = fillToCSS(node.fills.at(0))
  if (fill) style['background-color'] = css('fills/0/color', fill)
  addImageStyle(style, node)
  addStroke(style, node, css)
  Object.assign(style, effectsToCSS(node.effects))
  if (node.opacity < 1) style.opacity = css('opacity', String(node.opacity))
  addCornerRadii(style, node, css)
  if (node.clipsContent) style.overflow = 'hidden'
  const alignSelf = alignToCSS(node.layoutAlignSelf)
  if (alignSelf) style['align-self'] = alignSelf

  addLayoutChild(style, node, parent)
  if (node.layoutDirection === 'RTL') style.direction = 'rtl'

  if (node.layoutMode === 'GRID') {
    addGridContainer(style, node, css)
    addPadding(style, node, css)
  } else if (node.layoutMode !== 'NONE') {
    style.display = 'flex'
    // Row is the flexbox default.
    if (node.layoutMode === 'VERTICAL') style['flex-direction'] = 'column'
    const justifyContent = justifyContentToCSS(node.primaryAxisAlign)
    const alignItems = alignToCSS(node.counterAxisAlign)
    if (justifyContent) style['justify-content'] = justifyContent
    if (alignItems) style['align-items'] = alignItems
    if (node.layoutWrap === 'WRAP') style['flex-wrap'] = 'wrap'
    addFlexGap(style, node, css)
    addPadding(style, node, css)
  }

  return style
}

function styleFromTextNode(
  node: SceneNode,
  parent: SceneNode | undefined,
  css: FieldCSS
): DesignStyleDeclaration {
  const style: DesignStyleDeclaration = {}
  addSize(style, node, parent, css)
  addPositioning(style, node, parent)
  addLayoutChild(style, node, parent)
  if (resolveNodeTextDirection(node) === 'RTL') style.direction = 'rtl'
  const color = fillToCSS(node.fills.at(0))
  style.color = color ? css('fills/0/color', color) : cssColor(BLACK)
  style['font-family'] = node.fontFamily
  style['font-size'] = css('fontSize', px(node.fontSize))
  style['font-weight'] = String(node.fontWeight)
  if (node.italic) style['font-style'] = 'italic'
  if (node.lineHeight !== null) style['line-height'] = css('lineHeight', px(node.lineHeight))
  if (node.letterSpacing !== 0)
    style['letter-spacing'] = css('letterSpacing', px(node.letterSpacing))
  if (node.textAlignHorizontal !== 'LEFT')
    style['text-align'] = node.textAlignHorizontal.toLowerCase()
  if (node.opacity < 1) style.opacity = css('opacity', String(node.opacity))
  const shadow = dropShadowToCSS(node.effects[0])
  if (shadow) style['text-shadow'] = shadow
  if (node.textDecoration !== 'NONE') {
    style['text-decoration-line'] =
      node.textDecoration === 'UNDERLINE' ? 'underline' : 'line-through'
  }
  const textTransform = textCaseToCSS(node.textCase)
  if (textTransform) style['text-transform'] = textTransform
  style['white-space'] = node.maxLines === 1 ? 'nowrap' : 'pre-wrap'
  return style
}

function imageSourceURL(node: SceneNode): string | undefined {
  return node.pluginData.find(
    (entry) => entry.pluginId === DOM_CSS_PLUGIN_ID && entry.key === IMAGE_SOURCE_URL_KEY
  )?.value
}

function attrsForNode(
  graph: SceneGraph,
  node: SceneNode,
  includeSourceIds: boolean
): Record<string, string> {
  const attrs: Record<string, string> = includeSourceIds
    ? { 'data-open-pencil-node-id': node.id }
    : {}
  const sourceURL = imageSourceURL(node)
  if (sourceURL) attrs.src = sourceURL
  const fill = node.fills.at(0)
  if (fill?.type !== 'IMAGE' || !fill.imageHash) return attrs
  const bytes = graph.images.get(fill.imageHash)
  if (!bytes) return attrs
  return { ...attrs, src: `data:image/png;base64,${fromUint8Array(bytes)}` }
}

function tagNameForNode(node: SceneNode): string {
  if (node.type === 'SECTION') return 'section'
  const fill = node.fills.at(0)
  if ((fill?.type === 'IMAGE' || imageSourceURL(node)) && node.childIds.length === 0) return 'img'
  return 'div'
}

interface ProjectionContext {
  graph: SceneGraph
  includeSourceIds: boolean
  tokens: DesignTokens | undefined
}

function sceneNodeToDesignNode(
  context: ProjectionContext,
  node: SceneNode,
  inherited: CSSModes,
  root: boolean
): DesignNode | null {
  if (!node.visible || node.internalOnly) return null
  const { graph, includeSourceIds, tokens } = context
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  const entered = tokens?.enter(node, inherited, root)
  const modes = entered?.modes ?? inherited
  const attrs = { ...attrsForNode(graph, node, includeSourceIds), ...entered?.attrs }
  const css: FieldCSS = (field, literal) => tokens?.reference(node, field, modes) ?? literal

  if (node.type === 'TEXT') {
    return {
      type: 'element',
      tagName: 'span',
      attrs,
      inlineStyle: styleFromTextNode(node, parent, css),
      sourceSceneNodeId: node.id,
      sourceSceneNode: node,
      children: [{ type: 'text', text: node.text }]
    }
  }

  const children = nodeChildren(graph, node)
    .map((child) => sceneNodeToDesignNode(context, child, modes, false))
    .filter((child): child is DesignNode => child !== null)

  if (node.type === 'CANVAS') {
    return {
      type: 'element',
      tagName: 'main',
      attrs,
      sourceSceneNodeId: node.id,
      sourceSceneNode: node,
      children
    }
  }

  return {
    type: 'element',
    tagName: tagNameForNode(node),
    attrs,
    inlineStyle: styleFromSceneNode(node, parent, css),
    sourceSceneNodeId: node.id,
    sourceSceneNode: node,
    children
  }
}

function projectionContext(
  graph: SceneGraph,
  { includeSourceIds = true, tokens = true }: SceneGraphToDesignOptions
): ProjectionContext {
  return { graph, includeSourceIds, tokens: tokens ? new DesignTokens(graph) : undefined }
}

export function sceneGraphToDesignDocument(
  graph: SceneGraph,
  options: SceneGraphToDesignOptions = {}
): DesignDocument {
  const root = graph.getNode(options.rootId ?? graph.rootId)
  const context = projectionContext(graph, options)
  const modes = context.tokens?.defaultModes() ?? new Map<string, string>()
  const children = root
    ? nodeChildren(graph, root)
        .map((child) => sceneNodeToDesignNode(context, child, modes, true))
        .filter((child): child is DesignNode => child !== null)
    : []

  return { type: 'document', sourceGraph: graph, tokens: context.tokens, children }
}

/** Project one node, including its own box, instead of the children of a root. */
export function sceneNodeToDesignDocument(
  graph: SceneGraph,
  nodeId: string,
  options: Omit<SceneGraphToDesignOptions, 'rootId'> = {}
): DesignDocument {
  const node = graph.getNode(nodeId)
  const context = projectionContext(graph, options)
  const modes = context.tokens?.defaultModes() ?? new Map<string, string>()
  const projected = node ? sceneNodeToDesignNode(context, node, modes, true) : null
  return {
    type: 'document',
    sourceGraph: graph,
    tokens: context.tokens,
    children: projected ? [projected] : []
  }
}

export type { SceneGraphToDesignOptions as ToDesignDocumentOptions }
