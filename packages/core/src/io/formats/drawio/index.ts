import type { DrawioCell, DrawioFile, DrawioPage } from '@open-pencil/drawio'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { connectorRoute, placeConnectorLabel } from '@open-pencil/scene-graph/connectors'
import { createShapeWithText } from '@open-pencil/scene-graph/generated'
import { fitEnclosingGroups } from '@open-pencil/scene-graph/group-bounds'

import { bindEdge, createEdge, labelPositionOf, type PendingEdge } from './edges'
import { readLabel } from './label'
import { labelFields, labelFormat, shapePaint } from './paint'
import { shapeName, vertexKind } from './shapes'

/** A cell's label as text and runs, in the cell's own style. */
function labelOf(cell: DrawioCell) {
  const format = labelFormat(cell.style)
  return { format, ...readLabel(cell.value, cell.style.values.html === '1', format) }
}

/** The first line of a label, as a layer's name. */
function nameOf(text: string, fallback: string): string {
  return text.split('\n')[0]?.trim() || fallback
}

/** Builds one draw.io page's cells into `pageId`, in draw.io's drawing order. */
class PageBuilder {
  /** The layer each draw.io cell or layer became. */
  private readonly layers = new Map<string, string>()
  private readonly edges: PendingEdge[] = []
  private readonly groups: string[] = []

  constructor(
    private readonly graph: SceneGraph,
    private readonly page: DrawioPage,
    private readonly pageId: string
  ) {}

  build() {
    const { graph, page, pageId } = this
    // One layer draws straight onto the page; several each become a group named after it.
    for (const [index, layer] of page.layers.entries()) {
      if (page.layers.length === 1) {
        this.layers.set(layer.id, pageId)
        continue
      }
      const group = graph.createNode('GROUP', pageId, {
        name: layer.name || `Layer ${index + 1}`,
        visible: layer.visible,
        locked: layer.locked
      })
      this.layers.set(layer.id, group.id)
      this.groups.push(group.id)
    }
    const parents = new Set(page.cells.map((cell) => cell.parent))
    const labelsOf = new Map<string, DrawioCell[]>()
    const edgeIds = new Set(
      page.cells.filter((cell) => cell.kind === 'edge').map((cell) => cell.id)
    )
    for (const cell of page.cells) {
      // A vertex inside an edge is one of its labels.
      if (edgeIds.has(cell.parent)) {
        const labels = labelsOf.get(cell.parent) ?? []
        labels.push(cell)
        labelsOf.set(cell.parent, labels)
      }
    }
    for (const cell of page.cells) {
      if (edgeIds.has(cell.parent)) continue
      const parentId = this.layers.get(cell.parent) ?? pageId
      if (cell.kind === 'edge') {
        const pending = createEdge(graph, parentId, cell, labelsOf.get(cell.id) ?? [])
        this.layers.set(cell.id, pending.connector.id)
        this.edges.push(pending)
        continue
      }
      const node = this.vertex(cell, parentId, parents.has(cell.id))
      this.layers.set(cell.id, node.id)
    }
    const layerOf = (cellId: string) => this.layers.get(cellId)
    for (const pending of this.edges) {
      for (const extra of bindEdge(graph, pending, layerOf)) this.edgeText(pending, extra)
    }
    // Groups fit around what they hold, the innermost first.
    for (const id of this.groups.toReversed()) fitEnclosingGroups(graph, [id])
  }

  private vertex(cell: DrawioCell, parentId: string, hasChildren: boolean): SceneNode {
    const { graph } = this
    const { x, y, width, height } = cell.geometry
    const kind = vertexKind(cell.style, hasChildren)
    const label = labelOf(cell)
    const box = { x, y, width, height, visible: cell.visible }
    if (kind.type === 'TEXT') {
      return graph.createNode('TEXT', parentId, {
        ...box,
        name: nameOf(label.text, 'Text'),
        ...labelFields(cell.style, label.format),
        text: label.text,
        styleRuns: label.runs,
        textAutoResize: 'NONE'
      })
    }
    if (kind.type === 'SECTION') {
      return graph.createNode('SECTION', parentId, {
        ...box,
        ...shapePaint(cell.style),
        name: nameOf(label.text, 'Section')
      })
    }
    if (kind.type === 'GROUP') {
      const group = graph.createNode('GROUP', parentId, {
        ...box,
        name: nameOf(label.text, 'Group')
      })
      this.groups.push(group.id)
      return group
    }
    // A shape turned a quarter swaps its sides, about the centre of the box it fills.
    const quarter = Math.abs(kind.rotation) === 90
    const placed = quarter
      ? { x: x + (width - height) / 2, y: y + (height - width) / 2, width: height, height: width }
      : { x, y, width, height }
    const known = shapeName(cell.style)
    return createShapeWithText(
      graph,
      parentId,
      {
        ...placed,
        visible: cell.visible,
        rotation: kind.rotation,
        shapeWithTextType: kind.shape,
        ...shapePaint(cell.style),
        // A stencil FigJam has no shape for keeps its name, so it can be found and replaced.
        name: kind.stencil ? known : nameOf(label.text, 'Shape with text')
      },
      { ...labelFields(cell.style, label.format), text: label.text, styleRuns: label.runs }
    )
  }

  /** A label beyond an edge's first, as text where draw.io placed it along the edge. */
  private edgeText({ connector }: PendingEdge, cell: DrawioCell) {
    const { graph } = this
    const node = graph.getNode(connector.id)
    const route = node ? connectorRoute(graph, node) : null
    if (!node?.parentId || !route) return
    const label = labelOf(cell)
    const size = { width: cell.geometry.width, height: cell.geometry.height }
    const plate = placeConnectorLabel(route.pieces, size, labelPositionOf(cell.geometry.x))?.plate
    const offset = cell.geometry.offset ?? { x: 0, y: 0 }
    graph.createNode('TEXT', node.parentId, {
      x: (plate?.x ?? 0) + offset.x,
      y: (plate?.y ?? 0) + offset.y,
      name: nameOf(label.text, 'Text'),
      ...labelFields(cell.style, label.format),
      text: label.text,
      styleRuns: label.runs,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
  }
}

/**
 * A draw.io file as layers: each page a page, its shapes FigJam shapes with text, its edges
 * connectors joined to them, its layers groups when there are several, in draw.io's drawing order.
 * Text sizes are left for layout, which measures them once fonts load.
 */
export function drawioToSceneGraph(file: DrawioFile): SceneGraph {
  const graph = new SceneGraph()
  const first = graph.getPages().at(0)
  for (const [index, page] of file.pages.entries()) {
    const pageNode = index === 0 && first ? first : graph.addPage(page.name)
    if (index === 0) graph.updateNode(pageNode.id, { name: page.name })
    new PageBuilder(graph, page, pageNode.id).build()
  }
  return graph
}
