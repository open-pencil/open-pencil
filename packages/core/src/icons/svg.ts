import { iconToSVG } from '@iconify/utils'
import svgpath from 'svgpath'

import { parseSVGPath } from '#core/io/formats/svg/parse-path'

import type { IconData, IconifyIconEntry, IconPathInfo } from './types'

function attrValue(tag: string, attr: string): string | null {
  const re = new RegExp(`\\b${attr}="([^"]*)"`)
  const match = tag.match(re)
  return match ? match[1] : null
}

function num(tag: string, attr: string, fallback = 0): number {
  const value = attrValue(tag, attr)
  return value !== null ? parseFloat(value) : fallback
}

function shapeToD(tagName: string, tag: string): string | null {
  switch (tagName) {
    case 'circle': {
      const cx = num(tag, 'cx'),
        cy = num(tag, 'cy'),
        r = num(tag, 'r')
      return r > 0
        ? `M${cx - r},${cy}A${r},${r},0,1,0,${cx + r},${cy}A${r},${r},0,1,0,${cx - r},${cy}Z`
        : null
    }
    case 'ellipse': {
      const cx = num(tag, 'cx'),
        cy = num(tag, 'cy'),
        rx = num(tag, 'rx'),
        ry = num(tag, 'ry')
      return rx > 0 && ry > 0
        ? `M${cx - rx},${cy}A${rx},${ry},0,1,0,${cx + rx},${cy}A${rx},${ry},0,1,0,${cx - rx},${cy}Z`
        : null
    }
    case 'rect': {
      const x = num(tag, 'x'),
        y = num(tag, 'y'),
        width = num(tag, 'width'),
        height = num(tag, 'height')
      if (width <= 0 || height <= 0) return null
      const rx = Math.min(num(tag, 'rx'), width / 2),
        ry = Math.min(num(tag, 'ry', rx), height / 2)
      if (rx > 0 || ry > 0) {
        const arx = rx || ry,
          ary = ry || rx
        return `M${x + arx},${y}H${x + width - arx}A${arx},${ary},0,0,1,${x + width},${y + ary}V${y + height - ary}A${arx},${ary},0,0,1,${x + width - arx},${y + height}H${x + arx}A${arx},${ary},0,0,1,${x},${y + height - ary}V${y + ary}A${arx},${ary},0,0,1,${x + arx},${y}Z`
      }
      return `M${x},${y}H${x + width}V${y + height}H${x}Z`
    }
    case 'line': {
      const x1 = num(tag, 'x1'),
        y1 = num(tag, 'y1'),
        x2 = num(tag, 'x2'),
        y2 = num(tag, 'y2')
      return `M${x1},${y1}L${x2},${y2}`
    }
    case 'polygon':
    case 'polyline': {
      const points = attrValue(tag, 'points')
      if (!points) return null
      const values = points.trim().split(/[\s,]+/).map(Number)
      if (values.length < 4) return null
      let d = `M${values[0]},${values[1]}`
      for (let i = 2; i < values.length; i += 2) d += `L${values[i]},${values[i + 1]}`
      if (tagName === 'polygon') d += 'Z'
      return d
    }
    default:
      return null
  }
}

function resolveAttr(
  explicit: string | null,
  group: string | null,
  fallback: string | null
): string | null {
  if (explicit !== null) return explicit === 'none' ? null : explicit
  if (group !== null) return group === 'none' ? null : group
  return fallback
}

function extractPaths(svgBody: string): IconPathInfo[] {
  const groupAttrs = {
    fill: null as string | null,
    stroke: null as string | null,
    strokeWidth: null as string | null,
    strokeCap: null as string | null,
    strokeJoin: null as string | null,
  }
  const groupRe = /<g\b[^>]*>/g
  let groupMatch
  while ((groupMatch = groupRe.exec(svgBody)) !== null) {
    groupAttrs.fill ??= attrValue(groupMatch[0], 'fill')
    groupAttrs.stroke ??= attrValue(groupMatch[0], 'stroke')
    groupAttrs.strokeWidth ??= attrValue(groupMatch[0], 'stroke-width')
    groupAttrs.strokeCap ??= attrValue(groupMatch[0], 'stroke-linecap')
    groupAttrs.strokeJoin ??= attrValue(groupMatch[0], 'stroke-linejoin')
  }

  const result: IconPathInfo[] = []
  const shapeRe = /<(path|circle|ellipse|rect|line|polygon|polyline)\b[^>]*>/g
  let match
  while ((match = shapeRe.exec(svgBody)) !== null) {
    const tag = match[0],
      tagName = match[1]
    const d = tagName === 'path' ? attrValue(tag, 'd') : shapeToD(tagName, tag)
    if (!d) continue

    const fillRuleAttr = attrValue(tag, 'fill-rule')
    result.push({
      d,
      fill: resolveAttr(attrValue(tag, 'fill'), groupAttrs.fill, 'currentColor'),
      stroke: resolveAttr(attrValue(tag, 'stroke'), groupAttrs.stroke, null),
      strokeWidth: parseFloat(attrValue(tag, 'stroke-width') ?? groupAttrs.strokeWidth ?? '1'),
      strokeCap: attrValue(tag, 'stroke-linecap') ?? groupAttrs.strokeCap ?? 'butt',
      strokeJoin: attrValue(tag, 'stroke-linejoin') ?? groupAttrs.strokeJoin ?? 'miter',
      fillRule: fillRuleAttr === 'evenodd' ? 'EVENODD' : 'NONZERO',
    })
  }
  return result
}

export function buildIconData(
  iconEntry: IconifyIconEntry,
  prefix: string,
  iconName: string,
  defaultW: number,
  defaultH: number,
  size: number
): IconData {
  const rendered = iconToSVG({
    body: iconEntry.body,
    width: iconEntry.width ?? defaultW,
    height: iconEntry.height ?? defaultH,
  })
  const [, , viewBoxWidth, viewBoxHeight] = rendered.viewBox
  const scaleX = size / viewBoxWidth
  const scaleY = size / viewBoxHeight

  const pathInfos = extractPaths(rendered.body)

  return {
    prefix,
    name: iconName,
    width: size,
    height: size,
    paths: pathInfos.map((path) => {
      const scaledD =
        scaleX === 1 && scaleY === 1
          ? path.d
          : svgpath(path.d).scale(scaleX, scaleY).round(2).toString()
      return {
        vectorNetwork: parseSVGPath(scaledD, path.fillRule),
        fill: path.fill,
        stroke: path.stroke,
        strokeWidth: path.strokeWidth * Math.min(scaleX, scaleY),
        strokeCap: path.strokeCap,
        strokeJoin: path.strokeJoin,
      }
    }),
  }
}
