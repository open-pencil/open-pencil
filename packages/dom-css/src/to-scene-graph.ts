import { SceneGraph, type Fill, type SceneNode } from '@open-pencil/core/scene-graph'

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
  if (width !== null) node.width = width
  if (height !== null) node.height = height
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

function applyElementStyle(node: SceneNode, style: DesignStyleDeclaration): void {
  setNodeBox(node, style)

  const fills = fillsFromStyle(style, 'background-color')
  if (fills.length > 0) node.fills = fills

  const strokes = colorToStrokeFromCSS(
    pickStyle(style, 'border-color'),
    pickStyle(style, 'border-width')
  )
  if (strokes.length > 0) node.strokes = strokes

  const effects = dropShadowFromCSS(pickStyle(style, 'box-shadow'))
  if (effects.length > 0) node.effects = effects

  const opacity = parseCSSNumber(pickStyle(style, 'opacity'))
  if (opacity !== null) node.opacity = opacity

  const cornerRadius = firstCSSNumber(style, 'border-radius')
  if (cornerRadius !== null) node.cornerRadius = cornerRadius

  const display = pickStyle(style, 'display')
  if (display === 'flex' || display === 'inline-flex') {
    node.layoutMode = pickStyle(style, 'flex-direction') === 'column' ? 'VERTICAL' : 'HORIZONTAL'
    node.primaryAxisAlign = primaryAxisAlignFromCSS(pickStyle(style, 'justify-content'))
    node.counterAxisAlign = counterAxisAlignFromCSS(pickStyle(style, 'align-items'))
    node.itemSpacing = firstCSSNumber(style, 'gap', 'column-gap', 'row-gap') ?? 0
    node.paddingTop = firstCSSNumber(style, 'padding-top', 'padding') ?? 0
    node.paddingRight = firstCSSNumber(style, 'padding-right', 'padding') ?? 0
    node.paddingBottom = firstCSSNumber(style, 'padding-bottom', 'padding') ?? 0
    node.paddingLeft = firstCSSNumber(style, 'padding-left', 'padding') ?? 0
  }
}

function applyTextStyle(node: SceneNode, style: DesignStyleDeclaration): void {
  setNodeBox(node, style)

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

function createElementNode(graph: SceneGraph, parentId: string, element: DesignElement): SceneNode {
  const style = mergedStyle(element)
  if (isTextLikeElement(element) && element.children.every((child) => child.type === 'text')) {
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
