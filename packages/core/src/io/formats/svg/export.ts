import { computeContentBounds } from '@open-pencil/core/io/formats/raster'

import { resolveNodeTextDirection } from '../../../direction'
import {
  nextDefId,
  formatColor,
  createFilterDef,
  resolveFill,
  SVG_STROKE_CAP,
  SVG_STROKE_JOIN,
  SVG_BLEND_MODE
} from './defs'
import {
  round,
  geometryBlobToSVGPath,
  vectorNetworkToSVGPaths,
  makePolygonPoints,
  hasRadius,
  roundedRectPath,
  arcPath
} from './paths'

export { geometryBlobToSVGPath, vectorNetworkToSVGPaths } from './paths'

import { svg, renderSVGNode } from './node'

import type { SVGExportContext } from './defs'
import type { SVGNode } from './node'
import type {
  SceneGraph,
  SceneNode,
  Fill,
  Stroke,
  CharacterStyleOverride
} from '@open-pencil/core/scene-graph'

// --- Node rendering ---

function vectorShapeElements(
  node: SceneNode,
  common: Record<string, string | number | undefined>,
  strokeAttrs: Record<string, string | number | undefined>
): SVGNode[] {
  const elements: SVGNode[] = []
  if (node.fillGeometry.length > 0) {
    for (const geo of node.fillGeometry) {
      const d = geometryBlobToSVGPath(geo.commandsBlob)
      if (d) {
        elements.push(
          svg('path', {
            d,
            'fill-rule': geo.windingRule === 'EVENODD' ? 'evenodd' : undefined,
            ...common
          })
        )
      }
    }
  } else if (node.vectorNetwork) {
    const paths = vectorNetworkToSVGPaths(node.vectorNetwork)
    for (const d of paths) {
      elements.push(svg('path', { d, ...common }))
    }
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
  return elements.length > 0
    ? elements
    : [svg('rect', { width: round(node.width), height: round(node.height), ...common })]
}

function nodeShapeElements(
  node: SceneNode,
  fillAttr: string | null,
  strokeAttrs: Record<string, string | number | undefined>
): SVGNode[] {
  const common: Record<string, string | number | undefined> = {
    fill: fillAttr ?? 'none',
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

    case 'LINE':
      return [
        svg('line', {
          x1: 0,
          y1: 0,
          x2: round(node.width),
          y2: round(node.height),
          fill: 'none',
          ...strokeAttrs
        })
      ]

    case 'STAR':
    case 'POLYGON':
      return [svg('polygon', { points: makePolygonPoints(node), ...common })]

    case 'VECTOR':
      return vectorShapeElements(node, common, strokeAttrs)

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

function styleOverrideToTspanAttrs(
  style: CharacterStyleOverride,
  colorSpace: 'srgb' | 'display-p3'
): Record<string, string | number | undefined> {
  const attrs: Record<string, string | number | undefined> = {}
  if (style.fontFamily) attrs['font-family'] = style.fontFamily
  if (style.fontSize) attrs['font-size'] = style.fontSize
  if (style.fontWeight) attrs['font-weight'] = style.fontWeight
  if (style.italic) attrs['font-style'] = 'italic'
  if (style.letterSpacing) attrs['letter-spacing'] = round(style.letterSpacing)
  if (style.textDecoration === 'UNDERLINE') attrs['text-decoration'] = 'underline'
  if (style.textDecoration === 'STRIKETHROUGH') attrs['text-decoration'] = 'line-through'
  if (style.fills) {
    const visibleFill = style.fills.find((f) => f.visible && f.type === 'SOLID')
    if (visibleFill) {
      attrs.fill = formatColor(visibleFill.color, visibleFill.opacity, colorSpace)
    }
  }
  return attrs
}

function isLogicalTextEnd(node: SceneNode, direction: 'LTR' | 'RTL'): boolean {
  return (
    (direction === 'LTR' && node.textAlignHorizontal === 'RIGHT') ||
    (direction === 'RTL' && node.textAlignHorizontal === 'LEFT')
  )
}

function textAnchorForNode(
  node: SceneNode,
  direction: 'LTR' | 'RTL'
): 'middle' | 'end' | undefined {
  if (node.textAlignHorizontal === 'CENTER') return 'middle'
  if (isLogicalTextEnd(node, direction)) return 'end'
  return undefined
}

function textXForNode(node: SceneNode, direction: 'LTR' | 'RTL'): number {
  if (node.textAlignHorizontal === 'CENTER') return round(node.width / 2)
  if (isLogicalTextEnd(node, direction)) return round(node.width)
  return 0
}

function renderTextNode(
  node: SceneNode,
  fillAttr: string | null,
  colorSpace: 'srgb' | 'display-p3'
): SVGNode {
  const direction = resolveNodeTextDirection(node)
  const textAnchor = textAnchorForNode(node, direction)

  let textDecoration: 'underline' | 'line-through' | undefined
  if (node.textDecoration === 'UNDERLINE') textDecoration = 'underline'
  else if (node.textDecoration === 'STRIKETHROUGH') textDecoration = 'line-through'

  const attrs: Record<string, string | number | undefined> = {
    'font-family': node.fontFamily || undefined,
    'font-size': node.fontSize || undefined,
    'font-weight': node.fontWeight !== 400 ? node.fontWeight : undefined,
    'font-style': node.italic ? 'italic' : undefined,
    fill: fillAttr ?? undefined,
    direction: direction === 'RTL' ? 'rtl' : undefined,
    'text-anchor': textAnchor,
    'text-decoration': textDecoration,
    'letter-spacing': node.letterSpacing ? round(node.letterSpacing) : undefined
  }

  const x = textXForNode(node, direction)
  const y = node.fontSize || 14

  if (node.styleRuns.length > 0) {
    const spans: SVGNode[] = []
    let pos = 0
    for (const run of node.styleRuns) {
      const text = node.text.slice(pos, pos + run.length)
      pos += run.length
      spans.push(svg('tspan', styleOverrideToTspanAttrs(run.style, colorSpace), text))
    }

    return svg('text', { x, y, ...attrs }, ...spans)
  }

  return svg('text', { x, y, ...attrs }, node.text)
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
  colorSpace: 'srgb' | 'display-p3'
): Record<string, string | number | undefined> {
  if (visibleStrokes.length === 0) return {}
  const stroke = visibleStrokes[0]
  const attrs: Record<string, string | number | undefined> = {
    stroke: formatColor(stroke.color, 1, colorSpace),
    'stroke-width': round(stroke.weight)
  }
  if (stroke.opacity < 1) attrs['stroke-opacity'] = round(stroke.opacity)
  if (stroke.cap && stroke.cap !== 'NONE') {
    attrs['stroke-linecap'] = SVG_STROKE_CAP[stroke.cap] ?? 'butt'
  }
  if (stroke.join && stroke.join !== 'MITER') {
    attrs['stroke-linejoin'] = SVG_STROKE_JOIN[stroke.join] ?? 'miter'
  }
  if (stroke.dashPattern && stroke.dashPattern.length > 0) {
    attrs['stroke-dasharray'] = stroke.dashPattern.map((n) => round(n)).join(' ')
  }
  return attrs
}

function buildShapeChildren(
  node: SceneNode,
  visibleFills: Fill[],
  fillAttr: string | null,
  strokeAttrs: Record<string, string | number | undefined>,
  visibleStrokeCount: number,
  ctx: SVGExportContext
): SVGNode[] {
  if (visibleFills.length > 1) {
    const elements: SVGNode[] = []
    for (const fill of visibleFills) {
      const ref = resolveFill(fill, node, ctx)
      if (ref) {
        elements.push(
          ...nodeShapeElements(
            node,
            ref,
            fill === visibleFills[visibleFills.length - 1] ? strokeAttrs : {}
          )
        )
      }
    }
    return elements
  }

  const hasFillOrStroke = fillAttr || visibleStrokeCount > 0
  if (hasFillOrStroke && !isGroupLike(node)) {
    return nodeShapeElements(node, fillAttr, strokeAttrs)
  }

  return []
}

function renderNode(node: SceneNode, ctx: SVGExportContext): SVGNode | null {
  if (!node.visible) return null

  const { attrs: groupAttrs, clipId } = buildGroupAttrs(node, ctx)

  if (node.type === 'TEXT') {
    const firstFill = node.fills.find((f) => f.visible)
    const fillAttr = firstFill ? resolveFill(firstFill, node, ctx) : null
    const textEl = renderTextNode(node, fillAttr, ctx.colorSpace)
    return svg('g', groupAttrs, textEl)
  }

  const visibleFills = node.fills.filter((f) => f.visible)
  const visibleStrokes = node.strokes.filter((s) => s.visible)
  const fillAttr = visibleFills.length > 0 ? resolveFill(visibleFills[0], node, ctx) : null
  const strokeAttrs = buildSVGStrokeAttrs(visibleStrokes, ctx.colorSpace)

  const children: (SVGNode | null)[] = buildShapeChildren(
    node,
    visibleFills,
    fillAttr,
    strokeAttrs,
    visibleStrokes.length,
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
    colorSpace: options.colorSpace ?? 'srgb'
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
