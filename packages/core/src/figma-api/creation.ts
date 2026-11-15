import type { NodeType } from '@open-pencil/scene-graph'
import { createConnector, freeEndpoint } from '@open-pencil/scene-graph/connectors'

import type { InterfaceTheme } from '#core/constants'
import { layerTheme, newLayerDefaults } from '#core/editor/shapes/defaults'
import { createSVGNodes } from '#core/io/formats/svg'
import { textAutoResizeChanges } from '#core/layout/text-auto-resize'

import { graphOf } from './graph'
import type {
  FigmaComponentNode,
  FigmaConnectorNode,
  FigmaEllipseNode,
  FigmaFrameNode,
  FigmaLineNode,
  FigmaPolygonNode,
  FigmaRectangleNode,
  FigmaSectionNode,
  FigmaShapeWithTextNode,
  FigmaStarNode,
  FigmaTextNode,
  FigmaVectorNode
} from './node-types'
import { setDefaultPageBackground } from './page-backgrounds'
import type { FigmaNodeProxy } from './proxy'
import { newShapeWithText } from './shape-with-text'
import { FigmaStyleMethods } from './styles/api'

/**
 * Figma's `create*` members of `figma`, which make layers and pages on the current page as
 * Figma's plugin API makes them; `FigmaAPI` extends them.
 */
export abstract class FigmaCreateMethods extends FigmaStyleMethods {
  /** The interface theme new sections take their fill from, as in Figma. */
  abstract theme: InterfaceTheme
  abstract get currentPageId(): string
  abstract wrapNode(id: string): FigmaNodeProxy

  /** New layers start as the editor's tools make them, which is how Figma's plugin API makes them. */
  #createNode(type: NodeType): FigmaNodeProxy {
    const graph = graphOf(this)
    // A board's new sections are light under any interface theme, as the editor makes them.
    const theme = layerTheme({ documentKind: graph.documentKind, theme: this.theme })
    const defaults = newLayerDefaults(type, theme)
    // Figma's plugin API makes a line with no height, a 496 px section, and a hugging frame.
    if (type === 'LINE') defaults.height = 0
    if (type === 'SECTION') Object.assign(defaults, { width: 496, height: 496 })
    if (type === 'FRAME' || type === 'COMPONENT') defaults.primaryAxisSizing = 'HUG'
    const node = graph.createNode(type, this.currentPageId, defaults)
    return this.wrapNode(node.id)
  }

  createFrame(): FigmaFrameNode {
    return this.#createNode('FRAME') as FigmaFrameNode
  }

  createRectangle(): FigmaRectangleNode {
    return this.#createNode('RECTANGLE') as FigmaRectangleNode
  }

  createEllipse(): FigmaEllipseNode {
    return this.#createNode('ELLIPSE') as FigmaEllipseNode
  }

  createText(): FigmaTextNode {
    const text = this.#createNode('TEXT') as FigmaTextNode
    // Figma's plugin text starts empty at 12px and sizes itself to its content: no width, one
    // line tall.
    const graph = graphOf(this)
    const node = graph.getNode(text.id)
    const defaults = { fontSize: 12, textAutoResize: 'WIDTH_AND_HEIGHT' as const, width: 0 }
    graph.updateNode(text.id, { ...defaults, ...textAutoResizeChanges(node, defaults) })
    return text
  }

  createLine(): FigmaLineNode {
    return this.#createNode('LINE') as FigmaLineNode
  }

  createPolygon(): FigmaPolygonNode {
    return this.#createNode('POLYGON') as FigmaPolygonNode
  }

  createStar(): FigmaStarNode {
    return this.#createNode('STAR') as FigmaStarNode
  }

  createShapeWithText(): FigmaShapeWithTextNode {
    return this.wrapNode(newShapeWithText(this).id) as FigmaShapeWithTextNode
  }

  createVector(): FigmaVectorNode {
    return this.#createNode('VECTOR') as FigmaVectorNode
  }

  /** The layers Figma makes from SVG markup, on the current page at its origin. */
  // eslint-disable-next-line @open-pencil/structure/no-mixed-case-acronym-identifiers -- Figma Plugin API name.
  createNodeFromSvg(svg: string): FigmaFrameNode {
    const node = createSVGNodes(graphOf(this), this.currentPageId, svg, { keepEmpty: true })
    if (!node) throw new Error('in createNodeFromSvg: Failed to convert SVG file')
    return this.wrapNode(node.id) as FigmaFrameNode
  }

  /**
   * A connector as Figma's plugin API makes one: "Connector line", free from the page origin to
   * 200 px right of it, with no start cap and an arrow at the end.
   */
  createConnector(): FigmaConnectorNode {
    const node = createConnector(graphOf(this), this.currentPageId, {
      start: freeEndpoint(0, 0),
      end: freeEndpoint(200, 0),
      startCap: 'NONE',
      endCap: 'ARROW_LINES'
    })
    return this.wrapNode(node.id) as FigmaConnectorNode
  }

  createComponent(): FigmaComponentNode {
    return this.#createNode('COMPONENT') as FigmaComponentNode
  }

  createSection(): FigmaSectionNode {
    return this.#createNode('SECTION') as FigmaSectionNode
  }

  createPage(): FigmaNodeProxy {
    const graph = graphOf(this)
    const page = graph.addPage('Page')
    setDefaultPageBackground(graph, page, this.theme)
    return this.wrapNode(page.id)
  }
}
