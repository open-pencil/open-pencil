import { colorToHex, colorToHex8 } from './color'
import { computeContentBounds } from './render-image'

import { svg, renderSVGNode } from './svg-node'

import type { SVGNode } from './svg-node'
import type {
  SceneGraph,
  SceneNode,
  Fill,
  Effect,
  VectorNetwork,
  VectorSegment,
  VectorVertex
} from './scene-graph'
import type { Color } from './types'

const CMD_CLOSE = 0
const CMD_MOVE_TO = 1
const CMD_LINE_TO = 2
const CMD_CUBIC_TO = 4

interface SVGExportContext {
  defs: SVGNode[]
  defIdCounter: number
  graph: SceneGraph
}

function nextDefId(ctx: SVGExportContext, prefix: string): string {
  return `${prefix}${ctx.defIdCounter++}`
}

function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

function formatColor(color: Color, opacity = 1): string {
  return colorToHex8(color, opacity)
}

// --- Path data ---

export function geometryBlobToSVGPath(blob: Uint8Array): string {
  if (blob.length === 0) return ''
  const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  let o = 0
  const parts: string[] = []

  while (o < blob.length) {
    const cmd = blob[o++]
    switch (cmd) {
      case CMD_CLOSE:
        parts.push('Z')
        break
      case CMD_MOVE_TO: {
        const x = round(dv.getFloat32(o, true))
        const y = round(dv.getFloat32(o + 4, true))
        o += 8
        parts.push(`M${x} ${y}`)
        break
      }
      case CMD_LINE_TO: {
        const x = round(dv.getFloat32(o, true))
        const y = round(dv.getFloat32(o + 4, true))
        o += 8
        parts.push(`L${x} ${y}`)
        break
      }
      case CMD_CUBIC_TO: {
        const x1 = round(dv.getFloat32(o, true))
        const y1 = round(dv.getFloat32(o + 4, true))
        const x2 = round(dv.getFloat32(o + 8, true))
        const y2 = round(dv.getFloat32(o + 12, true))
        const x = round(dv.getFloat32(o + 16, true))
        const y = round(dv.getFloat32(o + 20, true))
        o += 24
        parts.push(`C${x1} ${y1} ${x2} ${y2} ${x} ${y}`)
        break
      }
      default:
        return parts.join('')
    }
  }

  return parts.join('')
}

function segmentToSVG(seg: VectorSegment, vertices: VectorVertex[], forward: boolean): string {
  const start = forward ? vertices[seg.start] : vertices[seg.end]
  const end = forward ? vertices[seg.end] : vertices[seg.start]
  const ts = forward ? seg.tangentStart : { x: -seg.tangentEnd.x, y: -seg.tangentEnd.y }
  const te = forward ? seg.tangentEnd : { x: -seg.tangentStart.x, y: -seg.tangentStart.y }

  const isStraight =
    Math.abs(ts.x) < 0.001 &&
    Math.abs(ts.y) < 0.001 &&
    Math.abs(te.x) < 0.001 &&
    Math.abs(te.y) < 0.001

  if (isStraight) {
    return `L${round(end.x)} ${round(end.y)}`
  }

  const cp1x = round(start.x + ts.x)
  const cp1y = round(start.y + ts.y)
  const cp2x = round(end.x + te.x)
  const cp2y = round(end.y + te.y)
  return `C${cp1x} ${cp1y} ${cp2x} ${cp2y} ${round(end.x)} ${round(end.y)}`
}

export function vectorNetworkToSVGPaths(network: VectorNetwork): string[] {
  const { vertices, segments, regions } = network

  if (regions.length > 0) {
    return regions.map((region) => {
      const parts: string[] = []
      for (const loop of region.loops) {
        if (loop.length === 0) continue
        const firstSeg = segments[loop[0]]
        parts.push(`M${round(vertices[firstSeg.start].x)} ${round(vertices[firstSeg.start].y)}`)
        for (const segIdx of loop) {
          parts.push(segmentToSVG(segments[segIdx], vertices, true))
        }
        parts.push('Z')
      }
      return parts.join('')
    })
  }

  const parts: string[] = []
  for (const seg of segments) {
    parts.push(`M${round(vertices[seg.start].x)} ${round(vertices[seg.start].y)}`)
    parts.push(segmentToSVG(seg, vertices, true))
  }

  return parts.length > 0 ? [parts.join('')] : []
}

// --- Gradients ---

function createGradientDef(
  fill: Fill,
  node: SceneNode,
  ctx: SVGExportContext
): { id: string; node: SVGNode } | null {
  const stops = fill.gradientStops
  const t = fill.gradientTransform
  if (!stops || !t) return null

  const stopNodes = stops.map((s) =>
    svg('stop', {
      offset: `${round(s.position * 100)}%`,
      'stop-color': colorToHex(s.color),
      'stop-opacity': s.color.a < 1 ? round(s.color.a) : undefined
    })
  )

  const id = nextDefId(ctx, 'grad')

  if (fill.type === 'GRADIENT_LINEAR') {
    const startX = round(t.m02 * 100)
    const startY = round(t.m12 * 100)
    const endX = round((t.m00 + t.m02) * 100)
    const endY = round((t.m10 + t.m12) * 100)
    return {
      id,
      node: svg(
        'linearGradient',
        {
          id,
          x1: `${startX}%`,
          y1: `${startY}%`,
          x2: `${endX}%`,
          y2: `${endY}%`,
          gradientUnits: 'objectBoundingBox'
        },
        ...stopNodes
      )
    }
  }

  if (fill.type === 'GRADIENT_RADIAL' || fill.type === 'GRADIENT_DIAMOND') {
    const cx = round(t.m02 * 100)
    const cy = round(t.m12 * 100)
    const r = round(Math.sqrt(t.m00 * t.m00 + t.m10 * t.m10) * 100)
    return {
      id,
      node: svg(
        'radialGradient',
        { id, cx: `${cx}%`, cy: `${cy}%`, r: `${r}%`, gradientUnits: 'objectBoundingBox' },
        ...stopNodes
      )
    }
  }

  if (fill.type === 'GRADIENT_ANGULAR') {
    const cx = round(t.m02 * node.width)
    const cy = round(t.m12 * node.height)
    const r = Math.max(node.width, node.height)
    return {
      id,
      node: svg(
        'radialGradient',
        { id, cx, cy, r, gradientUnits: 'userSpaceOnUse' },
        ...stopNodes
      )
    }
  }

  return null
}

// --- Image fills ---

function createImagePattern(
  fill: Fill,
  node: SceneNode,
  ctx: SVGExportContext
): { id: string; node: SVGNode } | null {
  if (!fill.imageHash) return null
  const data = ctx.graph.images.get(fill.imageHash)
  if (!data) return null

  const id = nextDefId(ctx, 'img')
  const base64 = btoa(String.fromCharCode(...data))
  const mime = detectImageMime(data)

  return {
    id,
    node: svg(
      'pattern',
      {
        id,
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1
      },
      svg('image', {
        href: `data:${mime};base64,${base64}`,
        width: node.width,
        height: node.height,
        preserveAspectRatio: fill.imageScaleMode === 'FIT' ? 'xMidYMid meet' : 'xMidYMid slice'
      })
    )
  }
}

function detectImageMime(data: Uint8Array): string {
  if (data[0] === 0x89 && data[1] === 0x50) return 'image/png'
  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg'
  if (data[0] === 0x52 && data[1] === 0x49) return 'image/webp'
  return 'image/png'
}

// --- Effects → SVG filters ---

function createFilterDef(effects: Effect[], ctx: SVGExportContext): { id: string; node: SVGNode } | null {
  const visible = effects.filter((e) => e.visible)
  if (visible.length === 0) return null

  const id = nextDefId(ctx, 'fx')
  const primitives: SVGNode[] = []

  for (const effect of visible) {
    if (effect.type === 'DROP_SHADOW') {
      const stdDev = round(effect.radius / 2)
      primitives.push(
        svg('feDropShadow', {
          dx: round(effect.offset.x),
          dy: round(effect.offset.y),
          stdDeviation: stdDev,
          'flood-color': colorToHex(effect.color),
          'flood-opacity': round(effect.color.a)
        })
      )
    } else if (effect.type === 'INNER_SHADOW') {
      const sid = `${id}_is`
      const stdDev = round(effect.radius / 2)
      primitives.push(
        svg('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: stdDev, result: `${sid}_blur` }),
        svg('feOffset', {
          dx: round(effect.offset.x),
          dy: round(effect.offset.y),
          result: `${sid}_off`
        }),
        svg('feComposite', {
          in: 'SourceAlpha',
          in2: `${sid}_off`,
          operator: 'out',
          result: `${sid}_inv`
        }),
        svg('feFlood', {
          'flood-color': colorToHex(effect.color),
          'flood-opacity': round(effect.color.a)
        }),
        svg('feComposite', { in2: `${sid}_inv`, operator: 'in', result: `${sid}_shadow` }),
        svg('feComposite', {
          in: `${sid}_shadow`,
          in2: 'SourceGraphic',
          operator: 'over'
        })
      )
    } else {
      const stdDev = round(effect.radius / 2)
      primitives.push(svg('feGaussianBlur', { stdDeviation: stdDev }))
    }
  }

  if (primitives.length === 0) return null

  return {
    id,
    node: svg('filter', { id }, ...primitives)
  }
}

// --- Fill resolution ---

function resolveFill(
  fill: Fill,
  node: SceneNode,
  ctx: SVGExportContext
): string | null {
  if (!fill.visible) return null

  if (fill.type === 'SOLID') {
    return formatColor(fill.color, fill.opacity)
  }

  if (fill.type.startsWith('GRADIENT')) {
    const grad = createGradientDef(fill, node, ctx)
    if (grad) {
      ctx.defs.push(grad.node)
      return `url(#${grad.id})`
    }
  }

  if (fill.type === 'IMAGE') {
    const pattern = createImagePattern(fill, node, ctx)
    if (pattern) {
      ctx.defs.push(pattern.node)
      return `url(#${pattern.id})`
    }
  }

  return null
}

// --- Stroke helpers ---

const SVG_STROKE_CAP: Record<string, string> = {
  NONE: 'butt',
  ROUND: 'round',
  SQUARE: 'square'
}

const SVG_STROKE_JOIN: Record<string, string> = {
  MITER: 'miter',
  ROUND: 'round',
  BEVEL: 'bevel'
}

const SVG_BLEND_MODE: Record<string, string> = {
  NORMAL: 'normal',
  DARKEN: 'darken',
  MULTIPLY: 'multiply',
  COLOR_BURN: 'color-burn',
  LIGHTEN: 'lighten',
  SCREEN: 'screen',
  COLOR_DODGE: 'color-dodge',
  OVERLAY: 'overlay',
  SOFT_LIGHT: 'soft-light',
  HARD_LIGHT: 'hard-light',
  DIFFERENCE: 'difference',
  EXCLUSION: 'exclusion',
  HUE: 'hue',
  SATURATION: 'saturation',
  COLOR: 'color',
  LUMINOSITY: 'luminosity'
}

// --- Shape builders ---

function makePolygonPoints(node: SceneNode): string {
  const cx = node.width / 2
  const cy = node.height / 2
  const rx = node.width / 2
  const ry = node.height / 2
  const n = Math.max(3, node.pointCount)
  const isStar = node.type === 'STAR'
  const innerRatio = isStar ? node.starInnerRadius : 1
  const totalPoints = isStar ? n * 2 : n
  const angleOffset = -Math.PI / 2

  const points: string[] = []
  for (let i = 0; i < totalPoints; i++) {
    const angle = angleOffset + (2 * Math.PI * i) / totalPoints
    const isInner = isStar && i % 2 === 1
    const r = isInner ? innerRatio : 1
    points.push(`${round(cx + rx * r * Math.cos(angle))},${round(cy + ry * r * Math.sin(angle))}`)
  }
  return points.join(' ')
}

function hasRadius(node: SceneNode): boolean {
  return (
    node.cornerRadius > 0 ||
    (node.independentCorners &&
      (node.topLeftRadius > 0 ||
        node.topRightRadius > 0 ||
        node.bottomRightRadius > 0 ||
        node.bottomLeftRadius > 0))
  )
}

function roundedRectPath(node: SceneNode): string {
  const w = node.width
  const h = node.height
  let tl: number, tr: number, br: number, bl: number
  if (node.independentCorners) {
    tl = node.topLeftRadius
    tr = node.topRightRadius
    br = node.bottomRightRadius
    bl = node.bottomLeftRadius
  } else {
    tl = tr = br = bl = node.cornerRadius
  }

  tl = Math.min(tl, w / 2, h / 2)
  tr = Math.min(tr, w / 2, h / 2)
  br = Math.min(br, w / 2, h / 2)
  bl = Math.min(bl, w / 2, h / 2)

  return [
    `M${round(tl)} 0`,
    `L${round(w - tr)} 0`,
    tr > 0 ? `A${round(tr)} ${round(tr)} 0 0 1 ${round(w)} ${round(tr)}` : '',
    `L${round(w)} ${round(h - br)}`,
    br > 0 ? `A${round(br)} ${round(br)} 0 0 1 ${round(w - br)} ${round(h)}` : '',
    `L${round(bl)} ${round(h)}`,
    bl > 0 ? `A${round(bl)} ${round(bl)} 0 0 1 0 ${round(h - bl)}` : '',
    `L0 ${round(tl)}`,
    tl > 0 ? `A${round(tl)} ${round(tl)} 0 0 1 ${round(tl)} 0` : '',
    'Z'
  ]
    .filter(Boolean)
    .join('')
}

function arcPath(node: SceneNode): string {
  if (!node.arcData) return ''
  const { startingAngle, endingAngle, innerRadius } = node.arcData
  const cx = node.width / 2
  const cy = node.height / 2
  const rx = node.width / 2
  const ry = node.height / 2

  const fullCircle = Math.abs(endingAngle - startingAngle) >= Math.PI * 2 - 0.001
  if (fullCircle && innerRadius <= 0) {
    return `M${round(cx - rx)} ${round(cy)}A${round(rx)} ${round(ry)} 0 1 1 ${round(cx + rx)} ${round(cy)}A${round(rx)} ${round(ry)} 0 1 1 ${round(cx - rx)} ${round(cy)}Z`
  }

  const x1 = round(cx + rx * Math.cos(startingAngle))
  const y1 = round(cy + ry * Math.sin(startingAngle))
  const x2 = round(cx + rx * Math.cos(endingAngle))
  const y2 = round(cy + ry * Math.sin(endingAngle))
  const largeArc = Math.abs(endingAngle - startingAngle) > Math.PI ? 1 : 0
  const sweep = endingAngle > startingAngle ? 1 : 0

  const parts = [`M${x1} ${y1}`, `A${round(rx)} ${round(ry)} 0 ${largeArc} ${sweep} ${x2} ${y2}`]

  if (innerRadius > 0) {
    const irx = rx * innerRadius
    const iry = ry * innerRadius
    const ix1 = round(cx + irx * Math.cos(endingAngle))
    const iy1 = round(cy + iry * Math.sin(endingAngle))
    const ix2 = round(cx + irx * Math.cos(startingAngle))
    const iy2 = round(cy + iry * Math.sin(startingAngle))
    parts.push(`L${ix1} ${iy1}`)
    parts.push(`A${round(irx)} ${round(iry)} 0 ${largeArc} ${sweep === 1 ? 0 : 1} ${ix2} ${iy2}`)
    parts.push('Z')
  } else {
    parts.push(`L${round(cx)} ${round(cy)}Z`)
  }

  return parts.join('')
}

// --- Node rendering ---

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

    case 'VECTOR': {
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

function renderTextNode(node: SceneNode, fillAttr: string | null): SVGNode {
  const attrs: Record<string, string | number | undefined> = {
    'font-family': node.fontFamily || undefined,
    'font-size': node.fontSize || undefined,
    'font-weight': node.fontWeight !== 400 ? node.fontWeight : undefined,
    'font-style': node.italic ? 'italic' : undefined,
    fill: fillAttr ?? undefined,
    'text-anchor':
      node.textAlignHorizontal === 'CENTER'
        ? 'middle'
        : (node.textAlignHorizontal === 'RIGHT'
          ? 'end'
          : undefined),
    'text-decoration':
      node.textDecoration === 'UNDERLINE'
        ? 'underline'
        : (node.textDecoration === 'STRIKETHROUGH'
          ? 'line-through'
          : undefined),
    'letter-spacing': node.letterSpacing ? round(node.letterSpacing) : undefined
  }

  const x =
    node.textAlignHorizontal === 'CENTER'
      ? round(node.width / 2)
      : (node.textAlignHorizontal === 'RIGHT'
        ? round(node.width)
        : 0)
  const y = node.fontSize || 14

  if (node.styleRuns.length > 0) {
    const spans: SVGNode[] = []
    let pos = 0
    for (const run of node.styleRuns) {
      const text = node.text.slice(pos, pos + run.length)
      pos += run.length
      const spanAttrs: Record<string, string | number | undefined> = {}
      if (run.style.fontFamily) spanAttrs['font-family'] = run.style.fontFamily
      if (run.style.fontSize) spanAttrs['font-size'] = run.style.fontSize
      if (run.style.fontWeight) spanAttrs['font-weight'] = run.style.fontWeight
      if (run.style.italic) spanAttrs['font-style'] = 'italic'
      if (run.style.letterSpacing) spanAttrs['letter-spacing'] = round(run.style.letterSpacing)
      if (run.style.textDecoration === 'UNDERLINE') spanAttrs['text-decoration'] = 'underline'
      if (run.style.textDecoration === 'STRIKETHROUGH')
        spanAttrs['text-decoration'] = 'line-through'

      if (Object.keys(spanAttrs).length > 0) {
        spans.push(svg('tspan', spanAttrs, text))
      } else {
        spans.push(svg('tspan', {}, text))
      }
    }

    return svg('text', { x, y, ...attrs }, ...spans)
  }

  return svg('text', { x, y, ...attrs }, node.text)
}

// --- Main recursive renderer ---

function renderNode(node: SceneNode, ctx: SVGExportContext): SVGNode | null {
  if (!node.visible) return null

  const children: (SVGNode | null)[] = []
  const groupAttrs: Record<string, string | number | undefined> = {}

  // Transform
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
  if (transforms.length > 0) groupAttrs.transform = transforms.join(' ')

  // Opacity
  if (node.opacity < 1) groupAttrs.opacity = round(node.opacity)

  // Blend mode
  const blend = SVG_BLEND_MODE[node.blendMode]
  if (blend && blend !== 'normal' && node.blendMode !== 'PASS_THROUGH') {
    groupAttrs.style = `mix-blend-mode: ${blend}`
  }

  // Effects → filter
  const filterDef = createFilterDef(node.effects, ctx)
  if (filterDef) {
    ctx.defs.push(filterDef.node)
    groupAttrs.filter = `url(#${filterDef.id})`
  }

  // Clip path for clipsContent
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

  // Text node
  if (node.type === 'TEXT') {
    const firstFill = node.fills.find((f) => f.visible)
    const fillAttr = firstFill ? resolveFill(firstFill, node, ctx) : null
    const textEl = renderTextNode(node, fillAttr)
    return svg('g', groupAttrs, textEl)
  }

  // Resolve fills and strokes
  const visibleFills = node.fills.filter((f) => f.visible)
  const visibleStrokes = node.strokes.filter((s) => s.visible)

  const fillAttr = visibleFills.length > 0 ? resolveFill(visibleFills[0], node, ctx) : null
  const strokeAttrs: Record<string, string | number | undefined> = {}

  if (visibleStrokes.length > 0) {
    const stroke = visibleStrokes[0]
    strokeAttrs.stroke = formatColor(stroke.color, 1)
    strokeAttrs['stroke-width'] = round(stroke.weight)
    if (stroke.opacity < 1) strokeAttrs['stroke-opacity'] = round(stroke.opacity)
    if (stroke.cap && stroke.cap !== 'NONE') {
      strokeAttrs['stroke-linecap'] = SVG_STROKE_CAP[stroke.cap] ?? 'butt'
    }
    if (stroke.join && stroke.join !== 'MITER') {
      strokeAttrs['stroke-linejoin'] = SVG_STROKE_JOIN[stroke.join] ?? 'miter'
    }
    if (stroke.dashPattern && stroke.dashPattern.length > 0) {
      strokeAttrs['stroke-dasharray'] = stroke.dashPattern.map((n) => round(n)).join(' ')
    }
  }

  // Multiple fills need stacking
  if (visibleFills.length > 1) {
    for (const fill of visibleFills) {
      const ref = resolveFill(fill, node, ctx)
      if (ref) {
        children.push(
          ...nodeShapeElements(
            node,
            ref,
            fill === visibleFills[visibleFills.length - 1] ? strokeAttrs : {}
          )
        )
      }
    }
  } else {
    const hasFillOrStroke = fillAttr || visibleStrokes.length > 0
    if (hasFillOrStroke && !isGroupLike(node)) {
      children.push(...nodeShapeElements(node, fillAttr, strokeAttrs))
    }
  }

  // Render children
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
    graph
  }

  const contentNodes: SVGNode[] = []

  for (const id of nodeIds) {
    const node = graph.getNode(id)
    if (!node || !node.visible) continue

    const abs = graph.getAbsolutePosition(id)
    const offsetX = abs.x - minX
    const offsetY = abs.y - minY

    const needsOffset = offsetX !== node.x || offsetY !== node.y
    const clone = needsOffset
      ? { ...node, x: round(offsetX), y: round(offsetY) }
      : node

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
