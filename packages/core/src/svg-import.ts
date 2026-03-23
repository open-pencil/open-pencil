import svgpath from 'svgpath'

import { parseSVGPath } from './svg-path-parse'

import type { WindingRule } from './scene-graph'
import type { IconData, IconPath } from './iconify'

export interface PathInfo {
  d: string
  fill: string | null
  stroke: string | null
  strokeWidth: number
  strokeCap: string
  strokeJoin: string
  fillRule: WindingRule
}

function attrValue(tag: string, attr: string): string | null {
  const re = new RegExp(`\\b${attr}="([^"]*)"`)
  const m = tag.match(re)
  return m ? m[1] : null
}

function num(tag: string, attr: string, fallback = 0): number {
  const v = attrValue(tag, attr)
  return v !== null ? parseFloat(v) : fallback
}

function shapeToD(tagName: string, tag: string): string | null {
  switch (tagName) {
    case 'circle': {
      const cx = num(tag, 'cx'), cy = num(tag, 'cy'), r = num(tag, 'r')
      return r > 0 ? `M${cx - r},${cy}A${r},${r},0,1,0,${cx + r},${cy}A${r},${r},0,1,0,${cx - r},${cy}Z` : null
    }
    case 'ellipse': {
      const cx = num(tag, 'cx'), cy = num(tag, 'cy'), rx = num(tag, 'rx'), ry = num(tag, 'ry')
      return rx > 0 && ry > 0 ? `M${cx - rx},${cy}A${rx},${ry},0,1,0,${cx + rx},${cy}A${rx},${ry},0,1,0,${cx - rx},${cy}Z` : null
    }
    case 'rect': {
      const x = num(tag, 'x'), y = num(tag, 'y'), w = num(tag, 'width'), h = num(tag, 'height')
      if (w <= 0 || h <= 0) return null
      const rx = Math.min(num(tag, 'rx'), w / 2), ry = Math.min(num(tag, 'ry', rx), h / 2)
      if (rx > 0 || ry > 0) {
        const arx = rx || ry, ary = ry || rx
        return `M${x + arx},${y}H${x + w - arx}A${arx},${ary},0,0,1,${x + w},${y + ary}V${y + h - ary}A${arx},${ary},0,0,1,${x + w - arx},${y + h}H${x + arx}A${arx},${ary},0,0,1,${x},${y + h - ary}V${y + ary}A${arx},${ary},0,0,1,${x + arx},${y}Z`
      }
      return `M${x},${y}H${x + w}V${y + h}H${x}Z`
    }
    case 'line': {
      const x1 = num(tag, 'x1'), y1 = num(tag, 'y1'), x2 = num(tag, 'x2'), y2 = num(tag, 'y2')
      return `M${x1},${y1}L${x2},${y2}`
    }
    case 'polygon':
    case 'polyline': {
      const points = attrValue(tag, 'points')
      if (!points) return null
      const nums = points.trim().split(/[\s,]+/).map(Number)
      if (nums.length < 4) return null
      let d = `M${nums[0]},${nums[1]}`
      for (let i = 2; i < nums.length; i += 2) d += `L${nums[i]},${nums[i + 1]}`
      if (tagName === 'polygon') d += 'Z'
      return d
    }
    default:
      return null
  }
}

function resolveAttr(explicit: string | null, group: string | null, fallback: string | null): string | null {
  if (explicit !== null) return explicit === 'none' ? null : explicit
  if (group !== null) return group === 'none' ? null : group
  return fallback
}

export function extractPaths(svgBody: string): PathInfo[] {
  const groupAttrs = { fill: null as string | null, stroke: null as string | null, strokeWidth: null as string | null, strokeCap: null as string | null, strokeJoin: null as string | null }
  const groupRe = /<g\b[^>]*>/g
  let gm
  while ((gm = groupRe.exec(svgBody)) !== null) {
    groupAttrs.fill ??= attrValue(gm[0], 'fill')
    groupAttrs.stroke ??= attrValue(gm[0], 'stroke')
    groupAttrs.strokeWidth ??= attrValue(gm[0], 'stroke-width')
    groupAttrs.strokeCap ??= attrValue(gm[0], 'stroke-linecap')
    groupAttrs.strokeJoin ??= attrValue(gm[0], 'stroke-linejoin')
  }

  const result: PathInfo[] = []
  const shapeRe = /<(path|circle|ellipse|rect|line|polygon|polyline)\b[^>]*>/g
  let match
  while ((match = shapeRe.exec(svgBody)) !== null) {
    const tag = match[0], tagName = match[1]
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
      fillRule: fillRuleAttr === 'evenodd' ? 'EVENODD' : 'NONZERO'
    })
  }
  return result
}

export function parseSVGFile(svgText: string, targetSize?: number): IconData {
  const svgMatch = svgText.match(/<svg\b[^>]*>/)
  const svgTag = svgMatch?.[0] ?? ''
  const vb = attrValue(svgTag, 'viewBox')
  let minX = 0, minY = 0, vbW = 0, vbH = 0
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number)
    ;[minX, minY, vbW, vbH] = parts
  }
  if (vbW <= 0) vbW = num(svgTag, 'width', 100)
  if (vbH <= 0) vbH = num(svgTag, 'height', 100)

  const body = svgText.replace(/<svg\b[^>]*>/, '').replace(/<\/svg\s*>/, '')
  const pathInfos = extractPaths(body)
  if (pathInfos.length === 0) {
    return { prefix: 'svg', name: 'imported', width: vbW, height: vbH, paths: [] }
  }

  const outW = targetSize ?? vbW
  const outH = targetSize ?? vbH
  const sx = outW / vbW
  const sy = outH / vbH

  const paths: IconPath[] = pathInfos.map((p) => {
    let d = p.d
    if (minX !== 0 || minY !== 0 || sx !== 1 || sy !== 1) {
      d = svgpath(d).translate(-minX, -minY).scale(sx, sy).round(2).toString()
    }
    return {
      vectorNetwork: parseSVGPath(d, p.fillRule),
      fill: p.fill,
      stroke: p.stroke,
      strokeWidth: p.strokeWidth * Math.min(sx, sy),
      strokeCap: p.strokeCap,
      strokeJoin: p.strokeJoin
    }
  })

  return { prefix: 'svg', name: 'imported', width: outW, height: outH, paths }
}
