import { SceneGraph, type Fill, type SceneNode, type Stroke } from '@open-pencil/core/scene-graph'

import {
  colorToFillFromCSS,
  colorToStrokeFromCSS,
  dropShadowFromCSS,
  mergedStyle,
  parseCSSNumber,
  pickStyle
} from './css-values'
import type { DesignDocument, DesignElement, DesignNode, DesignStyleDeclaration } from './types'

export interface DesignDocumentToSceneGraphOptions {
  pageName?: string
}

function textContent(node: DesignNode): string {
  if (node.type === 'text') return node.text
  return node.children.map(textContent).join('')
}

function isTextLikeElement(node: DesignElement): boolean {
  return [
    'span',
    'p',
    'label',
    'strong',
    'em',
    'button',
    'a',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6'
  ].includes(node.tagName.toLowerCase())
}

function firstCSSNumber(style: DesignStyleDeclaration, ...properties: string[]): number | null {
  for (const property of properties) {
    const parsed = parseCSSNumber(pickStyle(style, property))
    if (parsed !== null) return parsed
  }
  return null
}

function fillsFromStyle(style: DesignStyleDeclaration, property: string): Fill[] {
  return colorToFillFromCSS(pickStyle(style, property))
}

function setNodeBox(node: SceneNode, style: DesignStyleDeclaration): void {
  const width = firstCSSNumber(style, 'width')
  const height = firstCSSNumber(style, 'height')
  const minWidth = firstCSSNumber(style, 'min-width')
  const maxWidth = firstCSSNumber(style, 'max-width')
  const minHeight = firstCSSNumber(style, 'min-height')
  const maxHeight = firstCSSNumber(style, 'max-height')
  if (width !== null) node.width = width
  if (height !== null) node.height = height
  if (minWidth !== null) node.minWidth = minWidth
  if (maxWidth !== null) node.maxWidth = maxWidth
  if (minHeight !== null) node.minHeight = minHeight
  if (maxHeight !== null) node.maxHeight = maxHeight
}

function firstStrokeColor(style: DesignStyleDeclaration) {
  return (
    pickStyle(style, 'border-color') ??
    pickStyle(style, 'border-top-color') ??
    pickStyle(style, 'border-right-color') ??
    pickStyle(style, 'border-bottom-color') ??
    pickStyle(style, 'border-left-color')
  )
}

function strokeWeightFromStyle(style: DesignStyleDeclaration) {
  const borderWidth = firstCSSNumber(style, 'border-width')
  if (borderWidth !== null) return borderWidth

  const sideWeights = [
    firstCSSNumber(style, 'border-top-width'),
    firstCSSNumber(style, 'border-right-width'),
    firstCSSNumber(style, 'border-bottom-width'),
    firstCSSNumber(style, 'border-left-width')
  ].filter((weight): weight is number => weight !== null)
  if (sideWeights.length === 0) return null
  return Math.max(...sideWeights)
}

function setBorderWeights(node: SceneNode, style: DesignStyleDeclaration, stroke: Stroke): void {
  const top = firstCSSNumber(style, 'border-top-width') ?? stroke.weight
  const right = firstCSSNumber(style, 'border-right-width') ?? stroke.weight
  const bottom = firstCSSNumber(style, 'border-bottom-width') ?? stroke.weight
  const left = firstCSSNumber(style, 'border-left-width') ?? stroke.weight
  node.borderTopWeight = top
  node.borderRightWeight = right
  node.borderBottomWeight = bottom
  node.borderLeftWeight = left
  node.independentStrokeWeights = [top, right, bottom, left].some(
    (weight) => weight !== stroke.weight
  )
}

function applyCornerRadii(node: SceneNode, style: DesignStyleDeclaration): void {
  const cornerRadius = firstCSSNumber(style, 'border-radius')
  const topLeft = firstCSSNumber(style, 'border-top-left-radius')
  const topRight = firstCSSNumber(style, 'border-top-right-radius')
  const bottomRight = firstCSSNumber(style, 'border-bottom-right-radius')
  const bottomLeft = firstCSSNumber(style, 'border-bottom-left-radius')

  if (cornerRadius !== null) node.cornerRadius = cornerRadius
  if (topLeft === null && topRight === null && bottomRight === null && bottomLeft === null) return

  const fallback = cornerRadius ?? 0
  node.topLeftRadius = topLeft ?? fallback
  node.topRightRadius = topRight ?? fallback
  node.bottomRightRadius = bottomRight ?? fallback
  node.bottomLeftRadius = bottomLeft ?? fallback
  node.independentCorners = [
    node.topLeftRadius,
    node.topRightRadius,
    node.bottomRightRadius,
    node.bottomLeftRadius
  ].some((radius) => radius !== fallback)
}

function primaryAxisAlignFromCSS(value: string | undefined): SceneNode['primaryAxisAlign'] {
  if (value === 'center') return 'CENTER'
  if (value === 'end' || value === 'flex-end') return 'MAX'
  if (value === 'space-between') return 'SPACE_BETWEEN'
  return 'MIN'
}

function counterAxisAlignFromCSS(value: string | undefined): SceneNode['counterAxisAlign'] {
  if (value === 'center') return 'CENTER'
  if (value === 'end' || value === 'flex-end') return 'MAX'
  if (value === 'stretch') return 'STRETCH'
  if (value === 'baseline') return 'BASELINE'
  return 'MIN'
}

function layoutAlignSelfFromCSS(value: string | undefined): SceneNode['layoutAlignSelf'] {
  if (value === 'center') return 'CENTER'
  if (value === 'end' || value === 'flex-end') return 'MAX'
  if (value === 'stretch') return 'STRETCH'
  if (value === 'baseline') return 'BASELINE'
  if (value === 'start' || value === 'flex-start') return 'MIN'
  return 'AUTO'
}

function applyPositioning(node: SceneNode, style: DesignStyleDeclaration): void {
  const position = pickStyle(style, 'position')
  if (position === 'absolute' || position === 'fixed') node.layoutPositioning = 'ABSOLUTE'

  const left = firstCSSNumber(style, 'left')
  const top = firstCSSNumber(style, 'top')
  if (left !== null) node.x = left
  if (top !== null) node.y = top
}

function applyPadding(node: SceneNode, style: DesignStyleDeclaration): void {
  node.paddingTop = firstCSSNumber(style, 'padding-top', 'padding-block', 'padding') ?? 0
  node.paddingRight = firstCSSNumber(style, 'padding-right', 'padding-inline', 'padding') ?? 0
  node.paddingBottom = firstCSSNumber(style, 'padding-bottom', 'padding-block', 'padding') ?? 0
  node.paddingLeft = firstCSSNumber(style, 'padding-left', 'padding-inline', 'padding') ?? 0
}

function applyElementStyle(node: SceneNode, style: DesignStyleDeclaration): void {
  setNodeBox(node, style)
  applyPositioning(node, style)
  applyPadding(node, style)

  const fills = fillsFromStyle(style, 'background-color')
  if (fills.length > 0) node.fills = fills

  const strokes = colorToStrokeFromCSS(
    firstStrokeColor(style),
    strokeWeightFromStyle(style)?.toString()
  )
  if (strokes.length > 0) {
    node.strokes = strokes
    setBorderWeights(node, style, strokes[0])
  }

  const effects = dropShadowFromCSS(pickStyle(style, 'box-shadow'))
  if (effects.length > 0) node.effects = effects

  const opacity = parseCSSNumber(pickStyle(style, 'opacity'))
  if (opacity !== null) node.opacity = opacity

  applyCornerRadii(node, style)

  const overflow = pickStyle(style, 'overflow')
  if (overflow === 'hidden' || overflow === 'clip') node.clipsContent = true

  const alignSelf = layoutAlignSelfFromCSS(pickStyle(style, 'align-self'))
  if (alignSelf !== 'AUTO') node.layoutAlignSelf = alignSelf

  const display = pickStyle(style, 'display')
  if (display === 'flex' || display === 'inline-flex') {
    node.layoutMode = pickStyle(style, 'flex-direction') === 'column' ? 'VERTICAL' : 'HORIZONTAL'
    node.primaryAxisAlign = primaryAxisAlignFromCSS(pickStyle(style, 'justify-content'))
    node.counterAxisAlign = counterAxisAlignFromCSS(pickStyle(style, 'align-items'))
    node.layoutWrap = pickStyle(style, 'flex-wrap') === 'wrap' ? 'WRAP' : 'NO_WRAP'
    node.itemSpacing = firstCSSNumber(style, 'gap', 'column-gap', 'row-gap') ?? 0
    node.counterAxisSpacing = firstCSSNumber(style, 'row-gap') ?? 0
  }
}

function applyTextStyle(node: SceneNode, style: DesignStyleDeclaration): void {
  setNodeBox(node, style)
  applyPositioning(node, style)

  const fills = fillsFromStyle(style, 'color')
  if (fills.length > 0) node.fills = fills

  const fontSize = parseCSSNumber(pickStyle(style, 'font-size'))
  if (fontSize !== null) node.fontSize = fontSize

  const fontWeight = parseCSSNumber(pickStyle(style, 'font-weight'))
  if (fontWeight !== null) node.fontWeight = fontWeight

  const lineHeight = parseCSSNumber(pickStyle(style, 'line-height'))
  if (lineHeight !== null) node.lineHeight = lineHeight

  const letterSpacing = parseCSSNumber(pickStyle(style, 'letter-spacing'))
  if (letterSpacing !== null) node.letterSpacing = letterSpacing

  const opacity = parseCSSNumber(pickStyle(style, 'opacity'))
  if (opacity !== null) node.opacity = opacity

  const effects = dropShadowFromCSS(pickStyle(style, 'text-shadow'))
  if (effects.length > 0) node.effects = effects

  const fontFamily = pickStyle(style, 'font-family')
  if (fontFamily)
    node.fontFamily = fontFamily.split(',')[0]?.replaceAll('"', '').trim() || node.fontFamily

  node.italic = pickStyle(style, 'font-style') === 'italic'

  const textAlign = pickStyle(style, 'text-align')?.toUpperCase()
  if (textAlign === 'CENTER' || textAlign === 'RIGHT' || textAlign === 'JUSTIFIED') {
    node.textAlignHorizontal = textAlign
  }

  const textDecoration = pickStyle(style, 'text-decoration-line')
  if (textDecoration === 'underline') node.textDecoration = 'UNDERLINE'
  if (textDecoration === 'line-through') node.textDecoration = 'STRIKETHROUGH'
}

function createTextNode(
  graph: SceneGraph,
  parentId: string,
  text: string,
  style: DesignStyleDeclaration
) {
  const node = graph.createNode('TEXT', parentId, {
    name: text.slice(0, 32) || 'Text',
    text,
    width: Math.max(text.length * 8, 1),
    height: 20
  })
  applyTextStyle(node, style)
  return node
}

function hasBoxStyle(style: DesignStyleDeclaration): boolean {
  return [
    'background-color',
    'border-color',
    'border-width',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'border-radius',
    'box-shadow',
    'display',
    'height',
    'padding',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'padding-block',
    'padding-inline',
    'width',
    'min-width',
    'max-width',
    'min-height',
    'max-height',
    'overflow',
    'position',
    'top',
    'right',
    'bottom',
    'left',
    'flex-wrap',
    'align-self'
  ].some((property) => pickStyle(style, property) !== undefined)
}

function createElementNode(graph: SceneGraph, parentId: string, element: DesignElement): SceneNode {
  const style = mergedStyle(element)
  if (
    isTextLikeElement(element) &&
    !hasBoxStyle(style) &&
    element.children.every((child) => child.type === 'text')
  ) {
    return createTextNode(graph, parentId, textContent(element), style)
  }

  const node = graph.createNode('FRAME', parentId, {
    name: element.attrs.id || element.attrs.class || element.tagName,
    clipsContent: false
  })
  applyElementStyle(node, style)

  for (const child of element.children) {
    createDesignNode(graph, node.id, child, style)
  }

  return node
}

function createDesignNode(
  graph: SceneGraph,
  parentId: string,
  node: DesignNode,
  inheritedStyle: DesignStyleDeclaration = {}
): SceneNode | null {
  if (node.type === 'text') {
    if (node.text.trim().length === 0) return null
    return createTextNode(graph, parentId, node.text, inheritedStyle)
  }

  return createElementNode(graph, parentId, node)
}

function fitPageToChildren(page: SceneNode, graph: SceneGraph): void {
  const children = graph.getChildren(page.id)
  if (children.length === 0) return
  page.width = Math.max(...children.map((child) => child.x + child.width))
  page.height = Math.max(...children.map((child) => child.y + child.height))
}

export function designDocumentToSceneGraph(
  document: DesignDocument,
  options: DesignDocumentToSceneGraphOptions = {}
): SceneGraph {
  const graph = new SceneGraph()
  const page = graph.getPages().find((node) => node.type === 'CANVAS') ?? graph.addPage('DesignDOM')

  page.name = options.pageName ?? 'DesignDOM'

  for (const child of document.children) {
    createDesignNode(graph, page.id, child)
  }

  fitPageToChildren(page, graph)
  return graph
}

export type { DesignDocumentToSceneGraphOptions as ToSceneGraphOptions }
