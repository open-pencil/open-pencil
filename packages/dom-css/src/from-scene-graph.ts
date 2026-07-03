import { colorToCSS } from '@open-pencil/core/color'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { BLACK } from '@open-pencil/scene-graph/constants'

import {
  dropShadowToCSS,
  fillToCSS,
  sceneNodeSizeStyle,
  strokeColorToCSS,
  strokeToCSS
} from './css-values'
import type { DesignDocument, DesignNode, DesignStyleDeclaration } from './types'

const DOM_CSS_PLUGIN_ID = 'open-pencil-dom-css'
const IMAGE_SOURCE_URL_KEY = 'image-source-url'

export interface SceneGraphToDesignOptions {
  rootId?: string
  includeSourceIds?: boolean
}

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

function alignItemsToCSS(value: SceneNode['counterAxisAlign']): string | undefined {
  if (value === 'CENTER') return 'center'
  if (value === 'MAX') return 'flex-end'
  if (value === 'STRETCH') return 'stretch'
  if (value === 'BASELINE') return 'baseline'
  return undefined
}

function alignSelfToCSS(value: SceneNode['layoutAlignSelf']): string | undefined {
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

function addPositioning(style: DesignStyleDeclaration, node: SceneNode): void {
  if (node.layoutPositioning !== 'ABSOLUTE') return
  style.position = 'absolute'
  style.left = `${node.x}px`
  style.top = `${node.y}px`
}

function addSizeConstraints(style: DesignStyleDeclaration, node: SceneNode): void {
  if (node.minWidth !== null) style['min-width'] = `${node.minWidth}px`
  if (node.maxWidth !== null) style['max-width'] = `${node.maxWidth}px`
  if (node.minHeight !== null) style['min-height'] = `${node.minHeight}px`
  if (node.maxHeight !== null) style['max-height'] = `${node.maxHeight}px`
}

function addCornerRadii(style: DesignStyleDeclaration, node: SceneNode): void {
  if (node.independentCorners) {
    if (node.topLeftRadius > 0) style['border-top-left-radius'] = `${node.topLeftRadius}px`
    if (node.topRightRadius > 0) style['border-top-right-radius'] = `${node.topRightRadius}px`
    if (node.bottomRightRadius > 0)
      style['border-bottom-right-radius'] = `${node.bottomRightRadius}px`
    if (node.bottomLeftRadius > 0) style['border-bottom-left-radius'] = `${node.bottomLeftRadius}px`
    return
  }

  if (node.cornerRadius > 0) style['border-radius'] = `${node.cornerRadius}px`
}

function addStroke(style: DesignStyleDeclaration, node: SceneNode): void {
  const stroke = node.strokes[0]
  const border = strokeToCSS(stroke)
  if (!border) return
  const borderStyle = node.dashPattern.length > 0 ? 'dashed' : 'solid'
  if (!node.independentStrokeWeights) {
    style.border = border
    if (borderStyle !== 'solid') style['border-style'] = borderStyle
    return
  }

  const color = strokeColorToCSS(stroke) ?? 'currentColor'
  style['border-style'] = borderStyle
  style['border-color'] = color
  style['border-top-width'] = `${node.borderTopWeight}px`
  style['border-right-width'] = `${node.borderRightWeight}px`
  style['border-bottom-width'] = `${node.borderBottomWeight}px`
  style['border-left-width'] = `${node.borderLeftWeight}px`
}

function addPadding(style: DesignStyleDeclaration, node: SceneNode): void {
  const { paddingTop, paddingRight, paddingBottom, paddingLeft } = node
  if (paddingTop === 0 && paddingRight === 0 && paddingBottom === 0 && paddingLeft === 0) return

  if (
    paddingTop === paddingRight &&
    paddingRight === paddingBottom &&
    paddingBottom === paddingLeft
  ) {
    style.padding = `${paddingTop}px`
    return
  }

  if (paddingTop === paddingBottom && paddingRight === paddingLeft) {
    if (paddingTop > 0) style['padding-block'] = `${paddingTop}px`
    if (paddingRight > 0) style['padding-inline'] = `${paddingRight}px`
    return
  }

  if (paddingTop > 0) style['padding-top'] = `${paddingTop}px`
  if (paddingRight > 0) style['padding-right'] = `${paddingRight}px`
  if (paddingBottom > 0) style['padding-bottom'] = `${paddingBottom}px`
  if (paddingLeft > 0) style['padding-left'] = `${paddingLeft}px`
}

function addFlexGap(style: DesignStyleDeclaration, node: SceneNode): void {
  if (node.itemSpacing <= 0 && node.counterAxisSpacing <= 0) return
  if (node.counterAxisSpacing <= 0) {
    style.gap = `${node.itemSpacing}px`
    return
  }

  if (node.layoutMode === 'HORIZONTAL') {
    if (node.itemSpacing > 0) style['column-gap'] = `${node.itemSpacing}px`
    style['row-gap'] = `${node.counterAxisSpacing}px`
    return
  }

  if (node.itemSpacing > 0) style['row-gap'] = `${node.itemSpacing}px`
  style['column-gap'] = `${node.counterAxisSpacing}px`
}

function addImageStyle(style: DesignStyleDeclaration, node: SceneNode): void {
  const fill = node.fills.at(0)
  if (fill?.type !== 'IMAGE' || !fill.visible) return
  if (node.width > 0 && node.height > 0) style['aspect-ratio'] = `${node.width} / ${node.height}`
  if (fill.imageScaleMode === 'FIT') style['object-fit'] = 'contain'
  if (fill.imageScaleMode === 'FILL') style['object-fit'] = 'cover'
}

function styleFromSceneNode(node: SceneNode): DesignStyleDeclaration {
  const style = sceneNodeSizeStyle(node)
  addPositioning(style, node)
  addSizeConstraints(style, node)
  const fill = fillToCSS(node.fills.at(0))
  if (fill) style['background-color'] = fill
  addImageStyle(style, node)
  addStroke(style, node)
  const shadow = dropShadowToCSS(node.effects[0])
  if (shadow) style['box-shadow'] = shadow
  if (node.opacity < 1) style.opacity = String(node.opacity)
  addCornerRadii(style, node)
  if (node.clipsContent) style.overflow = 'hidden'
  const alignSelf = alignSelfToCSS(node.layoutAlignSelf)
  if (alignSelf) style['align-self'] = alignSelf

  if (node.layoutMode !== 'NONE') {
    style.display = 'flex'
    style['flex-direction'] = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column'
    const justifyContent = justifyContentToCSS(node.primaryAxisAlign)
    const alignItems = alignItemsToCSS(node.counterAxisAlign)
    if (justifyContent) style['justify-content'] = justifyContent
    if (alignItems) style['align-items'] = alignItems
    if (node.layoutWrap === 'WRAP') style['flex-wrap'] = 'wrap'
    addFlexGap(style, node)
    addPadding(style, node)
  }

  return style
}

function styleFromTextNode(node: SceneNode): DesignStyleDeclaration {
  const style = sceneNodeSizeStyle(node)
  addPositioning(style, node)
  style.color = fillToCSS(node.fills.at(0)) ?? colorToCSS(BLACK)
  style['font-family'] = node.fontFamily
  style['font-size'] = `${node.fontSize}px`
  style['font-weight'] = String(node.fontWeight)
  if (node.italic) style['font-style'] = 'italic'
  if (node.lineHeight !== null) style['line-height'] = `${node.lineHeight}px`
  if (node.letterSpacing !== 0) style['letter-spacing'] = `${node.letterSpacing}px`
  if (node.textAlignHorizontal !== 'LEFT')
    style['text-align'] = node.textAlignHorizontal.toLowerCase()
  if (node.opacity < 1) style.opacity = String(node.opacity)
  const shadow = dropShadowToCSS(node.effects[0])
  if (shadow) style['text-shadow'] = shadow
  if (node.textDecoration !== 'NONE') {
    style['text-decoration-line'] =
      node.textDecoration === 'UNDERLINE' ? 'underline' : 'line-through'
  }
  const textTransform = textCaseToCSS(node.textCase)
  if (textTransform) style['text-transform'] = textTransform
  if (node.maxLines === 1) style['white-space'] = 'nowrap'
  return style
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return globalThis.btoa(binary)
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
  return { ...attrs, src: `data:image/png;base64,${bytesToBase64(bytes)}` }
}

function tagNameForNode(node: SceneNode): string {
  const fill = node.fills.at(0)
  if ((fill?.type === 'IMAGE' || imageSourceURL(node)) && node.childIds.length === 0) return 'img'
  return 'div'
}

function sceneNodeToDesignNode(
  graph: SceneGraph,
  node: SceneNode,
  options: Required<SceneGraphToDesignOptions>
): DesignNode | null {
  if (!node.visible || node.internalOnly) return null

  if (node.type === 'TEXT') {
    return {
      type: 'element',
      tagName: 'span',
      attrs: attrsForNode(graph, node, options.includeSourceIds),
      inlineStyle: styleFromTextNode(node),
      sourceSceneNodeId: node.id,
      sourceSceneNode: node,
      children: [{ type: 'text', text: node.text }]
    }
  }

  const children = nodeChildren(graph, node)
    .map((child) => sceneNodeToDesignNode(graph, child, options))
    .filter((child): child is DesignNode => child !== null)

  if (node.type === 'CANVAS') {
    return {
      type: 'element',
      tagName: 'main',
      attrs: attrsForNode(graph, node, options.includeSourceIds),
      sourceSceneNodeId: node.id,
      sourceSceneNode: node,
      children
    }
  }

  return {
    type: 'element',
    tagName: tagNameForNode(node),
    attrs: attrsForNode(graph, node, options.includeSourceIds),
    inlineStyle: styleFromSceneNode(node),
    sourceSceneNodeId: node.id,
    sourceSceneNode: node,
    children
  }
}

export function sceneGraphToDesignDocument(
  graph: SceneGraph,
  options: SceneGraphToDesignOptions = {}
): DesignDocument {
  const root = graph.getNode(options.rootId ?? graph.rootId)
  const resolvedOptions: Required<SceneGraphToDesignOptions> = {
    rootId: options.rootId ?? graph.rootId,
    includeSourceIds: options.includeSourceIds ?? true
  }

  const children = root
    ? nodeChildren(graph, root)
        .map((child) => sceneNodeToDesignNode(graph, child, resolvedOptions))
        .filter((child): child is DesignNode => child !== null)
    : []

  return {
    type: 'document',
    sourceGraph: graph,
    children
  }
}

export type { SceneGraphToDesignOptions as ToDesignDocumentOptions }
