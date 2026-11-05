import {
  type Fill,
  type NodeType,
  type SceneNode,
  SceneGraph
} from '@open-pencil/scene-graph'

import type { EditorStore } from '@/app/editor/active-store'

import { colorToShadrHex, shadrHexToColor } from './converter/color'
import { parseCoordinate } from './converter/math'
import { SHADR_DATA_KEY, SHADR_PLUGIN_ID, getShadrData } from './data'
import type { ShadrElement, ShadrNodeData, ShadrPage, ShadrScreen } from './types'

export class ShadrConverter {
  /** Converts OpenPencil Canvas scene into Shadr Page JSON */
  exportPage(editor: EditorStore, pageName?: string): ShadrPage {
    const graph = editor.graph
    const pageNodes = graph.getPages()
    const currentPageId = editor.state.currentPageId || pageNodes[0]?.id
    const topNodes = graph.getChildren(currentPageId)

    const rootFrame = topNodes.find((n: SceneNode) => n.type === 'FRAME' && n.width >= 600)
    const screen: ShadrScreen = {
      width: rootFrame ? Math.round(rootFrame.width) : 1920,
      height: rootFrame ? Math.round(rootFrame.height) : 1080,
      cursorSize: 10,
      cursorSpeed: 2.0,
      cursorLayer: 9700
    }

    const sourceNodes = rootFrame ? graph.getChildren(rootFrame.id) : topNodes
    const blocks: ShadrElement[] = sourceNodes.map((n: SceneNode, i: number) =>
      this.#nodeToElement(n, graph, i)
    )

    const finalName =
      pageName ||
      rootFrame?.name ||
      pageNodes.find((p: SceneNode) => p.id === currentPageId)?.name ||
      'main_menu'

    return {
      name: finalName.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
      screen,
      blocks
    }
  }

  /** Converts Shadr Page JSON into OpenPencil SceneGraph */
  importPage(page: ShadrPage): SceneGraph {
    const graph = new SceneGraph()
    const pageNodes = graph.getPages()
    const pageNode =
      pageNodes[0] ??
      graph.createNode('CANVAS', graph.rootId, { name: page.name, width: 0, height: 0 })

    const rootFrame = graph.createNode('FRAME', pageNode.id, {
      name: page.name,
      x: 0,
      y: 0,
      width: page.screen?.width || 1920,
      height: page.screen?.height || 1080,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.05, g: 0.05, b: 0.08, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })

    if (page.blocks && Array.isArray(page.blocks)) {
      for (const block of page.blocks) {
        this.#elementToNode(block, rootFrame.id, graph)
      }
    }

    return graph
  }

  #nodeToElement(node: SceneNode, graph: SceneGraph, depth = 0): ShadrElement {
    const data = getShadrData(node)
    const id = data.blockId || node.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || `block_${node.id}`
    const layer = data.layer ?? depth * 2

    const base: ShadrElement = {
      type: 'block',
      id,
      layer,
      position: { x: Math.round(node.x), y: Math.round(node.y) },
      size: { width: Math.round(node.width), height: Math.round(node.height) }
    }

    if (data.interactive !== undefined) base.interactive = data.interactive
    if (data.hoverEffect) base.hoverEffect = data.hoverEffect
    if (data.clickEffect) base.clickEffect = data.clickEffect
    if (data.onClickAction && data.onClickAction.length > 0) base.onClickAction = data.onClickAction

    if (data.componentName) {
      base.type = 'component'
      base.component = data.componentName
      base.params = { id, ...(data.componentParams ?? {}) }
      return base
    }

    if (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL') {
      base.type = 'grid_block'
      base.direction = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column'
      base.gap = Math.round(node.itemSpacing || 0)
      base.children = graph
        .getChildren(node.id)
        .map((c: SceneNode, i: number) => this.#nodeToElement(c, graph, depth + 1 + i))
      return base
    }

    if (node.type === 'TEXT') {
      base.type = 'text'
      base.text = node.text || node.name
      base.font = data.customFont || 'shadr'
      const fill = (node.fills ?? []).find((f) => f.visible !== false)
      if (fill) base.color = colorToShadrHex(fill.color)
      const align = (node.textAlignHorizontal || 'LEFT').toLowerCase()
      base.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'
      return base
    }

    if (node.type === 'ELLIPSE') {
      base.type = 'circle'
      const fill = (node.fills ?? []).find((f) => f.visible !== false)
      if (fill) {
        base.color = colorToShadrHex(fill.color)
        base.opacity = Math.round((fill.opacity ?? 1) * 255)
      }
      return base
    }

    const primaryFill = (node.fills ?? []).find((f) => f.visible !== false)
    if (primaryFill) {
      base.type = primaryFill.type === 'GRADIENT_LINEAR' ? 'gradient' : 'block'
      base.color = colorToShadrHex(primaryFill.color)
      base.opacity = Math.round((primaryFill.opacity ?? 1) * 255)
    }

    if (node.cornerRadius && node.cornerRadius > 0) {
      base.type = 'block_rounded'
      base.rounding = { radius: Math.round(node.cornerRadius) }
    }

    const children = graph.getChildren(node.id)
    if (children.length > 0 && base.type !== 'grid_block') {
      base.children = children.map((c: SceneNode, i: number) =>
        this.#nodeToElement(c, graph, depth + 1 + i)
      )
    }

    return base
  }

  #elementToNode(elem: ShadrElement, parentId: string, graph: SceneGraph): SceneNode {
    const x = parseCoordinate(elem.position?.x, 0)
    const y = parseCoordinate(elem.position?.y, 0)
    const width = Math.max(1, parseCoordinate(elem.size?.width, 100))
    const height = Math.max(1, parseCoordinate(elem.size?.height, 40))

    const shadrData: ShadrNodeData = {
      blockId: elem.id,
      layer: elem.layer,
      interactive: elem.interactive,
      hoverEffect: elem.hoverEffect,
      clickEffect: elem.clickEffect,
      onClickAction: elem.onClickAction,
      componentName: elem.component,
      componentParams: elem.params,
      customFont: elem.font
    }

    let nodeType: NodeType = 'RECTANGLE'
    const props: Partial<SceneNode> = {
      name: elem.id || elem.type,
      x,
      y,
      width,
      height,
      pluginData: [
        { pluginId: SHADR_PLUGIN_ID, key: SHADR_DATA_KEY, value: JSON.stringify(shadrData) }
      ]
    }

    if (elem.color) {
      const { color, opacity } = shadrHexToColor(elem.color, elem.opacity)
      const fill: Fill = {
        type: elem.type === 'gradient' ? 'GRADIENT_LINEAR' : 'SOLID',
        color,
        opacity,
        visible: true
      }
      props.fills = [fill]
    }

    if (elem.rounding?.radius) {
      props.cornerRadius = elem.rounding.radius
    } else if (elem.rounding?.size) {
      props.cornerRadius = elem.rounding.size === 'small' ? 4 : elem.rounding.size === 'large' ? 12 : 8
    }

    if (elem.type === 'text') {
      nodeType = 'TEXT'
      props.text = elem.text ?? ''
      props.fontSize = Math.round(height * 0.8) || 16
      props.fontFamily = 'Inter'
      props.textAlignHorizontal = elem.textAlign === 'center' ? 'CENTER' : elem.textAlign === 'right' ? 'RIGHT' : 'LEFT'
    } else if (elem.type === 'grid_block') {
      nodeType = 'FRAME'
      props.layoutMode = elem.direction === 'column' ? 'VERTICAL' : 'HORIZONTAL'
      props.itemSpacing = elem.gap ?? 0
    } else if (elem.type === 'component') {
      nodeType = 'FRAME'
      props.name = `[${elem.component}] ${elem.id}`
    }

    const createdNode = graph.createNode(nodeType, parentId, props)
    if (elem.children && elem.children.length > 0) {
      for (const child of elem.children) {
        this.#elementToNode(child, createdNode.id, graph)
      }
    }

    return createdNode
  }
}

export const shadrConverter = new ShadrConverter()

// Re-exports for convenience and backward-compatibility
export const exportPageFromCanvas = (editor: EditorStore, pageName?: string) =>
  shadrConverter.exportPage(editor, pageName)
export const importPageToSceneGraph = (page: ShadrPage) =>
  shadrConverter.importPage(page)
export { colorToShadrHex, shadrHexToColor } from './converter/color'
export { parseCoordinate } from './converter/math'
