import { colorToCSS } from '@open-pencil/core/color'
import { BLACK } from '@open-pencil/core/constants'
import type { SceneGraph, SceneNode } from '@open-pencil/core/scene-graph'

import { dropShadowToCSS, fillToCSS, sceneNodeSizeStyle, strokeToCSS } from './css-values'
import type { DesignDocument, DesignNode, DesignStyleDeclaration } from './types'

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

function styleFromSceneNode(node: SceneNode): DesignStyleDeclaration {
  const style = sceneNodeSizeStyle(node)
  const fill = fillToCSS(node.fills[0])
  if (fill) style['background-color'] = fill
  const stroke = strokeToCSS(node.strokes[0])
  if (stroke) style.border = stroke
  const shadow = dropShadowToCSS(node.effects[0])
  if (shadow) style['box-shadow'] = shadow
  if (node.opacity < 1) style.opacity = String(node.opacity)
  if (node.cornerRadius > 0) style['border-radius'] = `${node.cornerRadius}px`

  if (node.layoutMode !== 'NONE') {
    style.display = 'flex'
    style['flex-direction'] = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column'
    const justifyContent = justifyContentToCSS(node.primaryAxisAlign)
    const alignItems = alignItemsToCSS(node.counterAxisAlign)
    if (justifyContent) style['justify-content'] = justifyContent
    if (alignItems) style['align-items'] = alignItems
    if (node.itemSpacing > 0) style.gap = `${node.itemSpacing}px`
    if (node.paddingTop > 0) style['padding-top'] = `${node.paddingTop}px`
    if (node.paddingRight > 0) style['padding-right'] = `${node.paddingRight}px`
    if (node.paddingBottom > 0) style['padding-bottom'] = `${node.paddingBottom}px`
    if (node.paddingLeft > 0) style['padding-left'] = `${node.paddingLeft}px`
  }

  return style
}

function styleFromTextNode(node: SceneNode): DesignStyleDeclaration {
  const style = sceneNodeSizeStyle(node)
  style.color = fillToCSS(node.fills[0]) ?? colorToCSS(BLACK)
  style['font-family'] = node.fontFamily
  style['font-size'] = `${node.fontSize}px`
  style['font-weight'] = String(node.fontWeight)
  if (node.italic) style['font-style'] = 'italic'
  if (node.lineHeight !== null) style['line-height'] = `${node.lineHeight}px`
  if (node.letterSpacing !== 0) style['letter-spacing'] = `${node.letterSpacing}px`
  if (node.textAlignHorizontal !== 'LEFT')
    style['text-align'] = node.textAlignHorizontal.toLowerCase()
  if (node.textDecoration !== 'NONE') {
    style['text-decoration-line'] =
      node.textDecoration === 'UNDERLINE' ? 'underline' : 'line-through'
  }
  return style
}

function attrsForNode(node: SceneNode, includeSourceIds: boolean): Record<string, string> {
  return includeSourceIds ? { 'data-open-pencil-node-id': node.id } : {}
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
      attrs: attrsForNode(node, options.includeSourceIds),
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
      attrs: attrsForNode(node, options.includeSourceIds),
      sourceSceneNodeId: node.id,
      sourceSceneNode: node,
      children
    }
  }

  return {
    type: 'element',
    tagName: 'div',
    attrs: attrsForNode(node, options.includeSourceIds),
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
