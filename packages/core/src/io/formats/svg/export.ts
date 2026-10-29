import type { RenderColorSpace } from '@open-pencil/scene-graph/color'

import { normalizeDashPattern } from '#core/canvas/strokes'
import { lineStrokePath } from '#core/canvas/strokes/line'
import { fittedDashPattern } from '#core/canvas/strokes/sides'
import { computeContentBounds } from '#core/io/formats/raster'

import {
  nextDefId,
  formatSolidColor,
  createFilterDef,
  resolveFill,
  solidFillOpacity,
  SVG_STROKE_CAP,
  SVG_STROKE_JOIN,
  SVG_BLEND_MODE
} from './defs'
import {
  round,
  geometryBlobToSVGPath,
  makePolygonPoints,
  roundedPolygonPath,
  hasRadius,
  roundedRectPath,
  arcPath,
  shapeWithTextOutlinePath
} from './paths'

export { geometryBlobToSVGPath, nodeOutlinePath, type OutlineNode } from './paths'

import type { SceneGraph, SceneNode, Fill, Stroke, VectorNetwork } from '@open-pencil/scene-graph'
import { looseSegments, regionSVGPaths } from '@open-pencil/scene-graph/vector-network'

import { arrowHeadElements, openPathElements, vectorArrowHeads } from './arrows'
import type { SVGExportContext, SVGFontAlias } from './defs'
import { svg, renderSVGNode } from './node'
import type { SVGNode } from './node'
import { alignedStroke, alignedStrokeElement, shapeWithTextDetailElements } from './strokes'
import { renderTextNode } from './text/export'
import type { SVGTextLayout } from './text/lines'

// --- Node rendering ---

/**
 * A vector network's paths: its regions as they are traced, and its open segments as the canvas
 * strokes them, rounded and pulled back under their heads.
 */
function networkElements(
  node: SceneNode,
  network: VectorNetwork,
  common: Record<string, string | number | undefined>
): SVGNode[] {
  const regions = regionSVGPaths(network).map((d) => svg('path', { d, ...common }))
  if (looseSegments(network).length === 0) return regions
  return [...regions, ...openPathElements(node, network, common, looseSegments)]
}

function vectorShapeElements(
  node: SceneNode,
  common: Record<string, string | number | undefined>,
  strokeAttrs: Record<string, string | number | undefined>,
  ctx: SVGExportContext,
  fallbackFills?: Fill[]
): SVGNode[] {
  const elements: SVGNode[] = []
  if (node.fillGeometry.length > 0) {
    for (const geo of node.fillGeometry) {
      const d = geometryBlobToSVGPath(geo.commandsBlob)
      if (!d) continue
      const attrs = {
        d,
        'fill-rule': geo.windingRule === 'EVENODD' ? 'evenodd' : undefined,
        ...common
      }
      const pathFills = geo.fills?.length ? geo.fills : fallbackFills
      if (!pathFills) {
        elements.push(svg('path', attrs))
        continue
      }
      const visibleFills = pathFills.filter((fill) => fill.visible)
      if (visibleFills.length === 0) {
        elements.push(svg('path', { ...attrs, fill: 'none' }))
        continue
      }
      for (const [index, fill] of visibleFills.entries()) {
        const fillAttr = resolveFill(fill, node, ctx)
        if (!fillAttr) continue
        elements.push(
          svg('path', {
            ...attrs,
            fill: fillAttr,
            'fill-opacity': solidFillOpacity(fill, ctx.colorSpace),
            stroke: index === visibleFills.length - 1 ? common.stroke : 'none'
          })
        )
      }
    }
  } else if (node.vectorNetwork) {
    elements.push(...networkElements(node, node.vectorNetwork, common))
  }
  if (node.strokeGeometry.length > 0 && strokeAttrs.stroke && strokeAttrs.stroke !== 'none') {
    for (const geo of node.strokeGeometry) {
      const d = geometryBlobToSVGPath(geo.commandsBlob)
      if (d) {
        elements.push(
          svg('path', {
            d,
            fill: strokeAttrs.stroke as string,
            'fill-opacity': strokeAttrs['stroke-opacity'],
            stroke: 'none'
          })
        )
      }
    }
  }
  if (node.vectorNetwork) elements.push(...vectorArrowHeads(node, node.vectorNetwork, strokeAttrs))
  return elements.length > 0
    ? elements
    : [svg('rect', { width: round(node.width), height: round(node.height), ...common })]
}

/** A line's dashes stretched along it as the canvas lays them, half a dash at each end. */
function lineDashAttrs(stroke: Stroke | undefined, length: number) {
  const fitted = fittedDashPattern(length, normalizeDashPattern(stroke?.dashPattern))
  if (!fitted) return {}
  return {
    'stroke-dasharray': fitted.intervals.map((size) => round(size)).join(' '),
    'stroke-dashoffset': round(fitted.offset)
  }
}

function nodeShapeElements(
  node: SceneNode,
  fillAttr: string | null,
  fillOpacity: number | undefined,
  strokeAttrs: Record<string, string | number | undefined>,
  ctx: SVGExportContext
): SVGNode[] {
  const common: Record<string, string | number | undefined> = {
    fill: fillAttr ?? 'none',
    'fill-opacity': fillOpacity,
    ...strokeAttrs
  }

  switch (node.type) {
    case 'ELLIPSE': {
      if (node.arcData) {
        return [svg('path', { d: arcPath(node), ...common })]
      }
      return [
        svg('ellipse', {
          cx: round(node.width / 2),
          cy: round(node.height / 2),
          rx: round(node.width / 2),
          ry: round(node.height / 2),
          ...common
        })
      ]
    }

    case 'LINE': {
      // Where the canvas strokes it: to one side of the line, with its caps inside its length.
      const stroke = node.strokes.find((item) => item.visible)
      const {
        network,
        from: start,
        to: end
      } = lineStrokePath(node, stroke?.weight ?? 0, stroke?.cap ?? node.strokeCap)
      return [
        svg('line', {
          x1: round(start.x),
          y1: round(start.y),
          x2: round(end.x),
          y2: round(end.y),
          fill: 'none',
          ...strokeAttrs,
          ...lineDashAttrs(stroke, Math.hypot(end.x - start.x, end.y - start.y))
        }),
        ...arrowHeadElements(node, network, stroke, strokeAttrs)
      ]
    }

    case 'STAR':
    case 'POLYGON':
      return node.cornerRadius > 0
        ? [svg('path', { d: roundedPolygonPath(node), ...common })]
        : [svg('polygon', { points: makePolygonPoints(node), ...common })]

    case 'VECTOR':
      return vectorShapeElements(node, common, strokeAttrs, ctx)

    case 'SHAPE_WITH_TEXT':
      return shapeWithTextElements(node, common, strokeAttrs, ctx)

    default: {
      if (hasRadius(node)) {
        if (node.independentCorners) {
          return [svg('path', { d: roundedRectPath(node), ...common })]
        }
        return [
          svg('rect', {
            width: round(node.width),
            height: round(node.height),
            rx: round(node.cornerRadius),
            ry: round(node.cornerRadius),
            ...common
          })
        ]
      }
      return [svg('rect', { width: round(node.width), height: round(node.height), ...common })]
    }
  }
}

/**
 * A FigJam shape's outline, and its inner lines, such as a database's front rim, stroked as the
 * canvas strokes them: at the stroke's own weight, ending where the outline does.
 */
function shapeWithTextElements(
  node: SceneNode,
  common: Record<string, string | number | undefined>,
  strokeAttrs: Record<string, string | number | undefined>,
  ctx: SVGExportContext
): SVGNode[] {
  return [
    svg('path', { d: shapeWithTextOutlinePath(node), ...common }),
    ...shapeWithTextDetailElements(node, strokeAttrs, ctx)
  ]
}

// --- Main recursive renderer ---

function buildTransformAttr(node: SceneNode): string | undefined {
  const transforms: string[] = []
  if (node.x !== 0 || node.y !== 0) transforms.push(`translate(${round(node.x)}, ${round(node.y)})`)
  if (node.rotation !== 0) {
    transforms.push(
      `rotate(${round(node.rotation)}, ${round(node.width / 2)}, ${round(node.height / 2)})`
    )
  }
  if (node.flipX || node.flipY) {
    const tx = node.flipX ? node.width : 0
    const ty = node.flipY ? node.height : 0
    const sx = node.flipX ? -1 : 1
    const sy = node.flipY ? -1 : 1
    transforms.push(`translate(${round(tx)}, ${round(ty)}) scale(${sx}, ${sy})`)
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

  const blend = SVG_BLEND_MODE[node.blendMode]
  if (blend && blend !== 'normal' && node.blendMode !== 'PASS_THROUGH') {
    attrs.style = `mix-blend-mode: ${blend}`
  }

  const filterDef = createFilterDef(node.effects, ctx)
  if (filterDef) {
    ctx.defs.push(filterDef.node)
    attrs.filter = `url(#${filterDef.id})`
  }

  let clipId: string | undefined
  if (node.clipsContent && node.childIds.length > 0) {
    clipId = nextDefId(ctx, 'clip')
    ctx.defs.push(
      svg(
        'clipPath',
        { id: clipId },
        svg('rect', { width: round(node.width), height: round(node.height) })
      )
    )
  }

  return { attrs, clipId }
}

function buildSVGStrokeAttrs(
  visibleStrokes: Stroke[],
  colorSpace: 'srgb' | 'display-p3',
  nodeCap: SceneNode['strokeCap']
): Record<string, string | number | undefined> {
  if (visibleStrokes.length === 0) return {}
  const stroke = visibleStrokes[0]
  const cap = stroke.cap ?? nodeCap
  const attrs: Record<string, string | number | undefined> = {
    // Opacity 1 keeps the color opaque. Display P3 must not also keep color alpha here, or a
    // viewer multiplies it by stroke-opacity; the canvas paints stroke.opacity alone.
    stroke: formatSolidColor(stroke.color, 1, colorSpace),
    'stroke-width': round(stroke.weight)
  }
  if (stroke.opacity < 1) attrs['stroke-opacity'] = round(stroke.opacity)
  if (cap !== 'NONE') attrs['stroke-linecap'] = SVG_STROKE_CAP[cap] ?? 'butt'
  if (stroke.join && stroke.join !== 'MITER') {
    attrs['stroke-linejoin'] = SVG_STROKE_JOIN[stroke.join] ?? 'miter'
  }
  if (stroke.dashPattern && stroke.dashPattern.length > 0) {
    attrs['stroke-dasharray'] = stroke.dashPattern.map((n) => round(n)).join(' ')
  }
  return attrs
}

function hasPathLevelFills(node: SceneNode): boolean {
  return node.type === 'VECTOR' && node.fillGeometry.some((geometry) => geometry.fills?.length)
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
  const aligned = hasPathLevelFills(node) ? null : alignedStroke(node, visibleStrokes[0])
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

  if (visibleFills.length > 1) {
    const elements: SVGNode[] = []
    for (const fill of visibleFills) {
      const ref = resolveFill(fill, node, ctx)
      if (ref) {
        elements.push(
          ...nodeShapeElements(
            node,
            ref,
            solidFillOpacity(fill, ctx.colorSpace),
            fill === visibleFills[visibleFills.length - 1] ? strokeAttrs : {},
            ctx
          )
        )
      }
    }
    return elements
  }

  const hasFillOrStroke = fillAttr || visibleStrokeCount > 0
  if (hasFillOrStroke && !isGroupLike(node)) {
    return nodeShapeElements(node, fillAttr, fillOpacity, strokeAttrs, ctx)
  }

  return []
}

/** The paint CSS `color` sets, for a tinted icon path. */
const CURRENT_COLOR = 'currentColor'

/** A paint's SVG color and, for an sRGB solid, the `fill-opacity` beside it. */
function exportedFill(
  fill: Fill | undefined,
  node: SceneNode,
  ctx: SVGExportContext
): { color: string | null; opacity: number | undefined } {
  if (!fill) return { color: null, opacity: undefined }
  return {
    color: resolveFill(fill, node, ctx),
    opacity: solidFillOpacity(fill, ctx.colorSpace)
  }
}

function renderNode(node: SceneNode, ctx: SVGExportContext): SVGNode | null {
  if (!node.visible) return null

  const { attrs: groupAttrs, clipId } = buildGroupAttrs(node, ctx)

  if (node.type === 'TEXT') {
    const fill = exportedFill(
      node.fills.find((f) => f.visible),
      node,
      ctx
    )
    return svg('g', groupAttrs, renderTextNode(node, fill.color, ctx, fill.opacity))
  }

  const visibleFills = node.fills.filter((f) => f.visible)
  const visibleStrokes = node.strokes.filter((s) => s.visible)
  const tint = ctx.tint?.(node) ?? []
  const ownFill = visibleFills.length > 0 && !hasPathLevelFills(node) ? visibleFills[0] : undefined
  const fill = exportedFill(ownFill, node, ctx)
  const tintedFill = fill.color !== null && tint.includes('fill')
  const fillAttr = tintedFill ? CURRENT_COLOR : fill.color
  // `currentColor` has no alpha. Display P3 normally bakes solid opacity into the color, which a
  // tint throws away, so a tinted solid keeps `fill-opacity` in every color space.
  const fillOpacity = ownFill ? solidFillOpacity(ownFill, ctx.colorSpace, tintedFill) : fill.opacity
  const ownStrokes = buildSVGStrokeAttrs(visibleStrokes, ctx.colorSpace, node.strokeCap)
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

  const childNodes = ctx.graph.getChildren(node.id)
  const childContent: SVGNode[] = []
  for (const child of childNodes) {
    const rendered = renderNode(child, ctx)
    if (rendered) childContent.push(rendered)
  }

  if (clipId && childContent.length > 0) {
    children.push(svg('g', { 'clip-path': `url(#${clipId})` }, ...childContent))
  } else {
    children.push(...childContent)
  }

  const validChildren = children.filter((c): c is SVGNode => c !== null)

  if (validChildren.length === 0 && Object.keys(groupAttrs).length === 0) {
    return null
  }

  if (validChildren.length === 1 && Object.keys(groupAttrs).length === 0) {
    return validChildren[0]
  }

  return svg('g', groupAttrs, ...validChildren)
}

function isGroupLike(node: SceneNode): boolean {
  return node.type === 'GROUP'
}

// --- Public API ---

export interface SVGExportOptions {
  /** Include XML declaration (default: true) */
  xmlDeclaration?: boolean
  /** Target export color space (default: srgb) */
  colorSpace?: 'srgb' | 'display-p3'
  /**
   * Line breaks of text nodes as the editor laid them out, wraps included. Without them, only
   * explicit newlines start a new baseline, which renderers that do not wrap SVG text keep.
   */
  textLayout?: SVGTextLayout
  /**
   * A family to name a font face by instead of its own, such as the one a PDF embeds the face's
   * file under. Text in an aliased face is written in that family at normal weight and style.
   */
  fontAlias?: SVGFontAlias
}

export function renderNodesToSVG(
  graph: SceneGraph,
  _pageId: string,
  nodeIds: string[],
  options: SVGExportOptions = {}
): string | null {
  const bounds = computeContentBounds(graph, nodeIds)
  if (!bounds) return null

  const { minX, minY, maxX, maxY } = bounds
  const width = round(maxX - minX)
  const height = round(maxY - minY)

  const ctx: SVGExportContext = {
    defs: [],
    defIdCounter: 0,
    graph,
    colorSpace: options.colorSpace ?? 'srgb',
    textLayout: options.textLayout,
    fontAlias: options.fontAlias
  }

  const contentNodes: SVGNode[] = []

  for (const id of nodeIds) {
    const node = graph.getNode(id)
    if (!node?.visible) continue

    const abs = graph.getAbsolutePosition(id)
    const offsetX = abs.x - minX
    const offsetY = abs.y - minY

    const needsOffset = offsetX !== node.x || offsetY !== node.y
    const clone = needsOffset ? { ...node, x: round(offsetX), y: round(offsetY) } : node

    const rendered = renderNode(clone, ctx)
    if (rendered) contentNodes.push(rendered)
  }

  if (contentNodes.length === 0) return null

  const rootChildren: (SVGNode | string)[] = []
  if (ctx.defs.length > 0) {
    rootChildren.push(svg('defs', {}, ...ctx.defs))
  }
  rootChildren.push(...contentNodes)

  const root = svg(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      'xmlns:xlink': 'http://www.w3.org/1999/xlink',
      width,
      height,
      viewBox: `0 0 ${width} ${height}`
    },
    ...(rootChildren as SVGNode[])
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
    colorSpace = 'srgb',
    tint
  }: Pick<SVGExportContext, 'tint'> & { idPrefix: string; colorSpace?: RenderColorSpace }
): SVGNode | null {
  const ctx: SVGExportContext = { defs: [], defIdCounter: 0, graph, colorSpace, idPrefix, tint }
  const drawn = renderNode({ ...node, x: 0, y: 0, rotation: 0, opacity: 1 }, ctx)
  if (!drawn) return null
  // A straight line has no height or width, but its stroke still needs a viewport to draw in.
  const width = Math.max(1, round(node.width))
  const height = Math.max(1, round(node.height))
  return svg(
    'svg',
    { width, height, viewBox: `0 0 ${width} ${height}` },
    ctx.defs.length > 0 ? svg('defs', {}, ...ctx.defs) : null,
    drawn
  )
}
