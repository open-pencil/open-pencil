import { compact } from 'es-toolkit'

import {
  getNodeRotationOrigin,
  getWorldMatrix,
  localTransformFromWorld
} from '@open-pencil/scene-graph/coordinate'
import { CSS_BLEND_MODE } from '@open-pencil/scene-graph/css'
import Matrix from '@open-pencil/scene-graph/matrix'

import { exportBounds } from '#core/io/formats/raster'

import {
  nextDefId,
  drawnFills,
  resolveFill,
  solidFillOpacity,
  svgStrokeAttrs,
  type SVGExportContext
} from './defs'
import { layerEffects, withLayerEffects, type ExportEffectWarning } from './effects'
import { round } from './paths'

export { geometryBlobToSVGPath, nodeOutlinePath, type OutlineNode } from './paths'

import type { ColorProfile, Fill, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { clipsChildren } from '@open-pencil/scene-graph/node-defaults'
import { isFigmaShaderPaint } from '@open-pencil/scene-graph/paints'
import { hasRegionFills } from '@open-pencil/scene-graph/vector-network'
import { appendAll } from '@open-pencil/std/arrays'

import { booleanOutlines, type SVGBooleanOutlines } from './boolean/outline'
import { renderMaskedChildren } from './masks'
import { svg, svgElement, renderSVGNode } from './node'
import type { SVGNode } from './node'
import { boxOutlineElement, nodeShapeElements, vectorShapeElements } from './shapes'
import { alignedStroke, alignedStrokeElement, shapeWithTextDetailElements } from './strokes'
import { renderTextNode } from './text/export'
import type { SVGTextLayout } from './text/lines'

// --- Main recursive renderer ---

function buildTransformAttr(node: SceneNode): string | undefined {
  const transforms: string[] = []
  if (node.x !== 0 || node.y !== 0) transforms.push(`translate(${round(node.x)}, ${round(node.y)})`)
  if (node.flipX || node.flipY) {
    const tx = node.flipX ? node.width : 0
    const ty = node.flipY ? node.height : 0
    const sx = node.flipX ? -1 : 1
    const sy = node.flipY ? -1 : 1
    transforms.push(`translate(${round(tx)}, ${round(ty)}) scale(${sx}, ${sy})`)
  }
  if (node.rotation !== 0) {
    const pivot = getNodeRotationOrigin(node)
    transforms.push(`rotate(${round(node.rotation)}, ${round(pivot.x)}, ${round(pivot.y)})`)
  }
  return transforms.length > 0 ? transforms.join(' ') : undefined
}

function buildGroupAttrs(
  node: SceneNode,
  ctx: SVGExportContext
): { attrs: Record<string, string | number | undefined>; clipId?: string } {
  const attrs: Record<string, string | number | undefined> = {}

  const transform = buildTransformAttr(node)
  if (transform) attrs.transform = transform

  if (node.opacity < 1) attrs.opacity = round(node.opacity)

  const blend = CSS_BLEND_MODE[node.blendMode]
  if (blend && blend !== 'normal' && node.blendMode !== 'PASS_THROUGH') {
    attrs.style = `mix-blend-mode: ${blend}`
  }

  let clipId: string | undefined
  if (clipsChildren(node) && node.childIds.length > 0) {
    clipId = nextDefId(ctx, 'clip')
    ctx.defs.push(svg('clipPath', { id: clipId }, boxOutlineElement(node, {})))
  }

  return { attrs, clipId }
}

function hasPathLevelFills(node: SceneNode): boolean {
  return node.type === 'VECTOR' && hasRegionFills(node.vectorNetwork)
}

function buildShapeChildren(
  node: SceneNode,
  visibleFills: Fill[],
  fillAttr: string | null,
  fillOpacity: number | undefined,
  strokeAttrs: Record<string, string | number | undefined>,
  visibleStrokes: Stroke[],
  ctx: SVGExportContext
): SVGNode[] {
  const aligned = hasPathLevelFills(node) ? null : alignedStroke(node, visibleStrokes[0], ctx)
  if (!aligned) {
    return fillAndStrokeElements(
      node,
      visibleFills,
      fillAttr,
      fillOpacity,
      strokeAttrs,
      visibleStrokes.length,
      ctx
    )
  }
  // The fill goes as it is, and the stroke over it inside or outside the outline.
  return [
    ...fillAndStrokeElements(node, visibleFills, fillAttr, fillOpacity, {}, 0, ctx),
    ...alignedStrokeElement(node, aligned, strokeAttrs, ctx),
    ...(node.type === 'SHAPE_WITH_TEXT' ? shapeWithTextDetailElements(node, strokeAttrs, ctx) : [])
  ]
}

function fillAndStrokeElements(
  node: SceneNode,
  visibleFills: Fill[],
  fillAttr: string | null,
  fillOpacity: number | undefined,
  strokeAttrs: Record<string, string | number | undefined>,
  visibleStrokeCount: number,
  ctx: SVGExportContext
): SVGNode[] {
  if (hasPathLevelFills(node)) {
    return vectorShapeElements(
      node,
      { fill: fillAttr ?? 'none', 'fill-opacity': fillOpacity, ...strokeAttrs },
      strokeAttrs,
      ctx,
      visibleFills
    )
  }

  // A shape painted once per fill SVG can draw; with none, it draws below as one without fills.
  const drawn = visibleFills.length > 1 ? drawnFills(visibleFills, node, ctx) : []
  if (drawn.length > 0) {
    return drawn.flatMap(({ fill, paint }, index) =>
      nodeShapeElements(
        node,
        paint,
        solidFillOpacity(fill, ctx.colors),
        index === drawn.length - 1 ? strokeAttrs : {},
        ctx
      )
    )
  }

  const hasFillOrStroke = fillAttr || visibleStrokeCount > 0
  if (hasFillOrStroke && !isGroupLike(node)) {
    return nodeShapeElements(node, fillAttr, fillOpacity, strokeAttrs, ctx)
  }

  return []
}

/** The paint CSS `color` sets, for a tinted icon path. */
const CURRENT_COLOR = 'currentColor'

function drawsInSVG(paint: Fill): boolean {
  return paint.visible && !isFigmaShaderPaint(paint)
}

/** A paint's SVG color and, for an sRGB solid, the `fill-opacity` beside it. */
function exportedFill(
  fill: Fill | undefined,
  node: SceneNode,
  ctx: SVGExportContext
): { color: string | null; opacity: number | undefined } {
  if (!fill) return { color: null, opacity: undefined }
  return {
    color: resolveFill(fill, node, ctx),
    opacity: solidFillOpacity(fill, ctx.colors)
  }
}

function renderNode(node: SceneNode, ctx: SVGExportContext): SVGNode | null {
  if (!node.visible) return null
  // A layer without a name has nothing to be found by.
  if (!ctx.layerIds || !node.name) return drawNode(node, ctx)
  // Parents take their names before their children, so a repeated name counts in layer order.
  const id = layerId(node.name, ctx.layerIds)
  const drawn = drawNode(node, ctx)
  if (!drawn) return null
  // A layer drawn as its only child's element keeps that child's id and gets its own group.
  if ('id' in drawn.attrs) return svg('g', { id }, drawn)
  return { ...drawn, attrs: { id, ...drawn.attrs } }
}

/**
 * A layer's name as an element id, numbered from `_2` when an earlier layer has it, as Figma does,
 * and past any id already given out.
 */
function layerId(name: string, ids: NonNullable<SVGExportContext['layerIds']>): string {
  let count = ids.names.get(name) ?? 0
  let id: string
  do {
    count += 1
    id = count === 1 ? name : `${name}_${count}`
  } while (ids.taken.has(id))
  ids.names.set(name, count)
  ids.taken.add(id)
  return id
}

function drawNode(node: SceneNode, ctx: SVGExportContext): SVGNode | null {
  const effects = layerEffects(node, ctx)
  const { attrs: groupAttrs, clipId } = buildGroupAttrs(node, ctx)

  if (node.type === 'TEXT') {
    const fill = exportedFill(node.fills.find(drawsInSVG), node, ctx)
    const text = renderTextNode(node, fill.color, ctx, fill.opacity)
    return svgElement('g', groupAttrs, withLayerEffects([text], effects, groupAttrs))
  }

  const visibleFills = node.fills.filter(drawsInSVG)
  const visibleStrokes = node.strokes.filter(drawsInSVG)
  const tint = ctx.tint?.(node) ?? []
  const ownFill = visibleFills.length > 0 && !hasPathLevelFills(node) ? visibleFills[0] : undefined
  const fill = exportedFill(ownFill, node, ctx)
  const tintedFill = fill.color !== null && tint.includes('fill')
  const fillAttr = tintedFill ? CURRENT_COLOR : fill.color
  // `currentColor` has no alpha. Display P3 normally bakes solid opacity into the color, which a
  // tint throws away, so a tinted solid keeps `fill-opacity` in every color space.
  const fillOpacity = ownFill ? solidFillOpacity(ownFill, ctx.colors, tintedFill) : fill.opacity
  const ownStrokes = svgStrokeAttrs(visibleStrokes, ctx.colors, node.strokeCap)
  const strokeAttrs =
    ownStrokes.stroke && tint.includes('stroke')
      ? { ...ownStrokes, stroke: CURRENT_COLOR }
      : ownStrokes

  const children: (SVGNode | null)[] = buildShapeChildren(
    node,
    visibleFills,
    fillAttr,
    fillOpacity,
    strokeAttrs,
    visibleStrokes,
    ctx
  )

  // A boolean operation draws its combined shape, not its operands.
  const childNodes = booleanOutlines(node, ctx) ? [] : ctx.graph.getChildren(node.id)
  const childContent = renderMaskedChildren(childNodes, ctx, renderNode)

  if (clipId && childContent.length > 0) {
    children.push(svgElement('g', { 'clip-path': `url(#${clipId})` }, childContent))
  } else {
    appendAll(children, childContent)
  }

  const validChildren = withLayerEffects(compact(children), effects, groupAttrs)

  if (validChildren.length === 0 && Object.keys(groupAttrs).length === 0) {
    return null
  }

  if (validChildren.length === 1 && Object.keys(groupAttrs).length === 0) {
    return validChildren[0]
  }

  return svgElement('g', groupAttrs, validChildren)
}

function isGroupLike(node: SceneNode): boolean {
  return node.type === 'GROUP'
}

// --- Public API ---

export interface SVGExportOptions {
  /** Include XML declaration (default: true) */
  xmlDeclaration?: boolean
  /** The profile the SVG writes colors in; the document's own unless given. */
  colorSpace?: ColorProfile
  /** Receives each effect the export leaves out because SVG cannot draw it, such as glass. */
  onWarning?: (warning: ExportEffectWarning) => void
  /**
   * Line breaks of text nodes as the editor laid them out, wraps included. Without them, only
   * explicit newlines start a new baseline, which renderers that do not wrap SVG text keep.
   */
  textLayout?: SVGTextLayout
  /** Combined shapes of boolean operations. Without them, saved fill geometry stands in. */
  booleanOutlines?: SVGBooleanOutlines
  /** Each layer's name as its element's `id`, as Figma's "Include id attribute" writes it. */
  layerIds?: boolean
  /** Size the drawing to the layers' boxes rather than to everything they draw. */
  useAbsoluteBounds?: boolean
}

export function renderNodesToSVG(
  graph: SceneGraph,
  _pageId: string,
  nodeIds: string[],
  options: SVGExportOptions = {}
): string | null {
  const bounds = exportBounds(graph, nodeIds, options.useAbsoluteBounds)
  if (!bounds) return null

  const { minX, minY, maxX, maxY } = bounds
  const width = round(maxX - minX)
  const height = round(maxY - minY)

  const ctx: SVGExportContext = {
    defs: [],
    defIdCounter: 0,
    graph,
    colors: {
      from: graph.documentColorSpace,
      to: options.colorSpace ?? graph.documentColorSpace
    },
    onWarning: options.onWarning,
    textLayout: options.textLayout,
    booleanOutlines: options.booleanOutlines,
    layerIds: options.layerIds ? { names: new Map(), taken: new Set() } : undefined
  }

  const contentNodes: SVGNode[] = []
  const drawingOrigin = Matrix.translated(minX, minY)

  for (const id of nodeIds) {
    const node = graph.getNode(id)
    if (!node?.visible) continue

    const placed = {
      ...node,
      ...localTransformFromWorld(node, getWorldMatrix(node, graph), drawingOrigin)
    }
    const rendered = renderNode(placed, ctx)
    if (rendered) contentNodes.push(rendered)
  }

  if (contentNodes.length === 0) return null

  const rootChildren: (SVGNode | string)[] = []
  if (ctx.defs.length > 0) {
    rootChildren.push(svgElement('defs', {}, ctx.defs))
  }
  appendAll(rootChildren, contentNodes)

  const root = svgElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      'xmlns:xlink': 'http://www.w3.org/1999/xlink',
      width,
      height,
      viewBox: `0 0 ${width} ${height}`
    },
    rootChildren
  )

  const svgStr = renderSVGNode(root)
  const xmlDecl = options.xmlDeclaration !== false ? '<?xml version="1.0" encoding="UTF-8"?>\n' : ''
  return xmlDecl + svgStr
}

/**
 * One layer as an `<svg>` element sized to its box, for inlining in HTML where the box already
 * places, rotates, and fades it: the drawing starts at the layer's origin without its rotation
 * or opacity, and keeps its flips.
 */
export function renderNodeSVGElement(
  graph: SceneGraph,
  node: SceneNode,
  {
    idPrefix,
    colorSpace = graph.documentColorSpace,
    tint
  }: Pick<SVGExportOptions, 'colorSpace'> &
    Partial<Pick<SVGExportContext, 'tint'>> & {
      idPrefix: string
    }
): SVGNode | null {
  const colors = { from: graph.documentColorSpace, to: colorSpace }
  const ctx: SVGExportContext = { defs: [], defIdCounter: 0, graph, colors, idPrefix, tint }
  const drawn = renderNode({ ...node, x: 0, y: 0, rotation: 0, opacity: 1 }, ctx)
  if (!drawn) return null
  // A straight line has no height or width, but its stroke still needs a viewport to draw in.
  const width = Math.max(1, round(node.width))
  const height = Math.max(1, round(node.height))
  return svg(
    'svg',
    { width, height, viewBox: `0 0 ${width} ${height}` },
    ctx.defs.length > 0 ? svgElement('defs', {}, ctx.defs) : null,
    drawn
  )
}
