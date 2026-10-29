import type {
  FlowArrowhead,
  FlowEdge,
  FlowLabel,
  FlowNode,
  FlowSubgraph,
  Flowchart
} from '@open-pencil/mermaid'
import type { Fill, SceneGraph, SceneNode, Stroke, StrokeCap } from '@open-pencil/scene-graph'
import {
  connectorSublayers,
  createConnector,
  freeEndpoint
} from '@open-pencil/scene-graph/connectors'
import { BLACK } from '@open-pencil/scene-graph/constants'
import { createShapeWithText } from '@open-pencil/scene-graph/generated'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { newLayerDefaults } from '#core/editor/shapes/defaults'
import { layoutAuthoredNodes } from '#core/layout'
import { applyArrangement, type ArrangePlacement } from '#core/layout/arrange/apply'
import { arrangeBoxes, type ArrangeInput } from '#core/layout/arrange/boxes'
import { connectorLabelSize } from '#core/layout/arrange/routes'
import { shapeWithTextWidthFor } from '#core/layout/shape-with-text'
import { prepareGraphFonts } from '#core/text/prepare'

import { figJamShape } from './shapes'
import { declarationsFor, readStyle, type FlowStyle } from './styles'

/** Shape widths Mermaid's labels fit between, and how wide a label runs before it wraps. */
const MIN_SHAPE_WIDTH = 96
const MAX_SHAPE_WIDTH = 320
const LABEL_LINE_WIDTH = 200
/** The height a shape starts from; a label of more lines makes it taller. */
const SHAPE_HEIGHT = 56

/** How much wider Mermaid draws a thick edge, `==>`, than a normal one. */
const THICK = 1.5

/** Arrowheads as FigJam ends: Mermaid's filled triangle, dot, and cross. */
const CAPS: Record<FlowArrowhead, StrokeCap> = {
  none: 'NONE',
  arrow: 'ARROW_EQUILATERAL',
  circle: 'CIRCLE_FILLED',
  // FigJam has no cross end.
  cross: 'ARROW_LINES'
}

function solid(color: Color): Fill {
  return { type: 'SOLID', color: { ...color }, opacity: 1, visible: true }
}

/** Markdown's emphasis marks taken out, which a label shows as plain text for now. */
function labelText(label: FlowLabel): string {
  if (label.format === 'text') return label.text
  return label.text.replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/([*_])(.+?)\1/g, '$2')
}

function styledFills(layer: Partial<SceneNode>, style: FlowStyle): Fill[] | undefined {
  if (style.fill === undefined) return layer.fills
  return style.fill === null ? [] : [solid(style.fill)]
}

/** A stroke with a Mermaid style's colour, width, and dashes over it. */
function styledStroke(base: Stroke, style: FlowStyle): Stroke {
  const stroke: Stroke = { ...base, color: { ...base.color }, align: 'CENTER' }
  if (style.stroke) stroke.color = { ...style.stroke }
  if (style.strokeWidth !== undefined) stroke.weight = style.strokeWidth
  if (style.dashPattern) stroke.dashPattern = style.dashPattern
  return stroke
}

/** A layer's paint with a Mermaid style over it: fill, outline colour, width, and dashes. */
function painted(layer: Partial<SceneNode>, style: FlowStyle): Partial<SceneNode> {
  const result: Partial<SceneNode> = { ...layer, fills: styledFills(layer, style) }
  if (style.stroke === null) {
    result.strokes = []
    return result
  }
  if (!style.stroke && style.strokeWidth === undefined && !style.dashPattern) return result
  const base = layer.strokes?.at(0) ?? {
    ...solid(style.stroke ?? BLACK),
    weight: 1,
    align: 'CENTER'
  }
  const stroke = styledStroke(base, style)
  result.strokes = [stroke]
  result.strokeWeight = stroke.weight
  if (style.dashPattern) result.dashPattern = style.dashPattern
  return result
}

/** Where each node and subgraph sits: the subgraph holding it, if any. */
function enclosingSubgraphs(chart: Flowchart): Map<string, string> {
  const enclosing = new Map<string, string>()
  for (const subgraph of chart.subgraphs) {
    for (const member of subgraph.members) enclosing.set(member, subgraph.id)
  }
  return enclosing
}

class FlowchartBuilder {
  /** The layer each node and subgraph became. */
  readonly layers = new Map<string, string>()
  readonly connectors = new Map<string, string>()
  private readonly enclosing: Map<string, string>

  constructor(
    private readonly graph: SceneGraph,
    private readonly parentId: string,
    private readonly chart: Flowchart
  ) {
    this.enclosing = enclosingSubgraphs(chart)
  }

  /** The layer a node or subgraph goes in: its subgraph's section, or the diagram's parent. */
  private parentOf(id: string): string {
    const subgraph = this.enclosing.get(id)
    return (subgraph && this.layers.get(subgraph)) ?? this.parentId
  }

  sections() {
    const byId = new Map(this.chart.subgraphs.map((subgraph) => [subgraph.id, subgraph]))
    const create = (subgraph: FlowSubgraph) => {
      if (this.layers.has(subgraph.id)) return
      const outer = this.enclosing.get(subgraph.id)
      const outerSubgraph = outer ? byId.get(outer) : undefined
      if (outerSubgraph) create(outerSubgraph)
      const style = readStyle(
        declarationsFor(this.chart.classDefs, subgraph.classes, subgraph.styles)
      )
      const section = this.graph.createNode('SECTION', this.parentOf(subgraph.id), {
        ...painted(newLayerDefaults('SECTION'), style),
        name: labelText(subgraph.title) || subgraph.id
      })
      this.layers.set(subgraph.id, section.id)
    }
    for (const subgraph of this.chart.subgraphs) create(subgraph)
  }

  shape(node: FlowNode) {
    const { graph } = this
    const kind = figJamShape(node.shape)
    const style = readStyle(declarationsFor(this.chart.classDefs, node.classes, node.styles))
    const defaults = newLayerDefaults('SHAPE_WITH_TEXT')
    // Mermaid's text block draws its label alone.
    const own = node.shape === 'text' ? { ...defaults, fills: [], strokes: [] } : defaults
    const text = labelText(node.label)
    const shape = createShapeWithText(
      graph,
      this.parentOf(node.id),
      {
        ...painted(own, style),
        shapeWithTextType: kind.type,
        flipY: kind.flipY ?? false,
        width: MIN_SHAPE_WIDTH,
        height: kind.round ? MIN_SHAPE_WIDTH : SHAPE_HEIGHT,
        shapeTruncates: false,
        name: text.split('\n')[0]?.trim() || node.id
      },
      style.color ? { text, fills: [solid(style.color)] } : { text }
    )
    this.layers.set(node.id, shape.id)
  }

  /** Widens a node's shape until its label runs no wider than a line, as Mermaid sizes it. */
  fitWidth(node: FlowNode) {
    const { graph } = this
    const layerId = this.layers.get(node.id)
    const shape = layerId ? graph.getNode(layerId) : undefined
    if (!shape) return
    const { round } = figJamShape(node.shape)
    const width = shapeWithTextWidthFor(
      graph,
      shape,
      { min: MIN_SHAPE_WIDTH, max: MAX_SHAPE_WIDTH, lineWidth: LABEL_LINE_WIDTH },
      (candidate) => (round ? candidate : SHAPE_HEIGHT)
    )
    const height = round ? width : SHAPE_HEIGHT
    graph.updateNode(shape.id, { width, height, shapeUserHeight: height })
  }

  /** A connector for each drawn edge, its ends free until the layout places them. */
  connector(edge: FlowEdge) {
    if (edge.stroke === 'invisible') return
    const { graph } = this
    const style = readStyle(edge.styles)
    const connector = createConnector(graph, this.parentId, {
      start: freeEndpoint(0, 0),
      end: freeEndpoint(0, 0),
      lineType: 'ELBOWED',
      startCap: CAPS[edge.startArrow],
      endCap: CAPS[edge.endArrow],
      text: edge.label ? labelText(edge.label) : ''
    })
    const parts = connectorSublayers(graph, connector)
    const stroke = parts?.line.strokes.at(0)
    if (parts && stroke) {
      const weight = edge.stroke === 'thick' ? stroke.weight * THICK : stroke.weight
      const line = styledStroke(
        {
          ...stroke,
          weight,
          dashPattern: edge.stroke === 'dotted' ? [weight * 2, weight * 2] : []
        },
        style
      )
      graph.updateNode(parts.line.id, {
        strokes: style.stroke === null ? [] : [line],
        strokeWeight: line.weight,
        dashPattern: line.dashPattern ?? []
      })
      if (style.color) graph.updateNode(parts.label.id, { fills: [solid(style.color)] })
    }
    this.connectors.set(edge.id, connector.id)
  }
}

/** What a flowchart became. */
export interface FlowchartLayers {
  /** The layers added to the parent, in order. */
  ids: string[]
  /** The layer each node and subgraph became, by its Mermaid id. */
  layers: Map<string, string>
  /** The connector each drawn edge became, by its Mermaid id. */
  connectors: Map<string, string>
}

/**
 * Adds a flowchart to `parentId` as FigJam layers, where `placement` puts it: each node a
 * shape with text sized to its label, each subgraph a section, and each edge an elbowed connector
 * joined to the layers it links, all laid out by ELK along the chart's direction, its text
 * measured in the fonts it is drawn in.
 */
export async function addFlowchart(
  graph: SceneGraph,
  parentId: string,
  chart: Flowchart,
  placement: ArrangePlacement = { topLeft: { x: 0, y: 0 } }
): Promise<FlowchartLayers> {
  const before = new Set(graph.getNode(parentId)?.childIds)
  const builder = new FlowchartBuilder(graph, parentId, chart)
  const addedSoFar = () => (graph.getNode(parentId)?.childIds ?? []).filter((id) => !before.has(id))
  // Known before the first wait, so a layer someone else adds meanwhile is never taken for ours.
  let created: string[] | null = null
  try {
    builder.sections()
    for (const node of chart.nodes) builder.shape(node)
    for (const edge of chart.edges) builder.connector(edge)
    const added = addedSoFar()
    created = added
    // Shapes grow to their labels, and connector labels take their size, before the layout reads
    // them, measured in the fonts they are drawn in.
    await prepareGraphFonts(graph, added)
    for (const node of chart.nodes) builder.fitWidth(node)
    layoutAuthoredNodes(graph, added)
    const enclosing = enclosingSubgraphs(chart)
    const size = (id: string) => {
      const layer = builder.layers.get(id)
      const node = layer ? graph.getNode(layer) : undefined
      return { width: node?.width ?? MIN_SHAPE_WIDTH, height: node?.height ?? SHAPE_HEIGHT }
    }
    const labelSize = (edgeId: string) => {
      const connectorId = builder.connectors.get(edgeId)
      return (connectorId && connectorLabelSize(graph, connectorId)) || undefined
    }
    const input: ArrangeInput = {
      layout: 'flow',
      direction: chart.direction,
      boxes: chart.nodes.map((node) => ({
        id: node.id,
        ...size(node.id),
        group: enclosing.get(node.id)
      })),
      groups: chart.subgraphs.map((subgraph) => ({
        id: subgraph.id,
        group: enclosing.get(subgraph.id)
      })),
      edges: chart.edges.map((edge) => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        label: labelSize(edge.id)
      }))
    }
    const arrangement = await arrangeBoxes(input)
    applyArrangement(
      graph,
      input,
      arrangement,
      { boxes: builder.layers, connectors: builder.connectors },
      placement
    )
    return { ids: added, layers: builder.layers, connectors: builder.connectors }
  } catch (error) {
    // A flowchart that fails to lay out leaves nothing half-built behind.
    for (const id of (created ?? addedSoFar()).toReversed()) graph.deleteNode(id)
    throw error
  }
}
