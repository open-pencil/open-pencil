import { iconToSVG } from '@iconify/utils'
import type { Element, Node } from '@xmldom/xmldom'
import svgpath from 'svgpath'

import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'

import { parseSVGFragment } from '#core/io/formats/svg/document'

import type { IconData, IconifyIconEntry, IconPathInfo } from './types'

interface PresentationAttributes {
  fill: string
  stroke: string
  strokeWidth: string
  strokeCap: string
  strokeJoin: string
  fillRule: string
}

const DEFAULT_PRESENTATION: PresentationAttributes = {
  fill: 'currentColor',
  stroke: 'none',
  strokeWidth: '1',
  strokeCap: 'butt',
  strokeJoin: 'miter',
  fillRule: 'nonzero'
}

const SHAPE_NAMES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polygon', 'polyline'])
const NON_RENDERED_CONTAINERS = new Set(['defs', 'clipPath', 'mask', 'symbol'])

function isElement(node: Node): node is Element {
  return node.nodeType === node.ELEMENT_NODE
}

function inheritedAttribute(element: Element, name: string, inherited: string): string {
  return element.hasAttribute(name) ? (element.getAttribute(name) ?? inherited) : inherited
}

function presentationFor(
  element: Element,
  inherited: PresentationAttributes
): PresentationAttributes {
  return {
    fill: inheritedAttribute(element, 'fill', inherited.fill),
    stroke: inheritedAttribute(element, 'stroke', inherited.stroke),
    strokeWidth: inheritedAttribute(element, 'stroke-width', inherited.strokeWidth),
    strokeCap: inheritedAttribute(element, 'stroke-linecap', inherited.strokeCap),
    strokeJoin: inheritedAttribute(element, 'stroke-linejoin', inherited.strokeJoin),
    fillRule: inheritedAttribute(element, 'fill-rule', inherited.fillRule)
  }
}

function num(element: Element, attr: string, fallback = 0): number {
  const value = element.getAttribute(attr)
  if (value === null) return fallback
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function circleToD(element: Element): string | null {
  const cx = num(element, 'cx')
  const cy = num(element, 'cy')
  const r = num(element, 'r')
  return r > 0
    ? `M${cx - r},${cy}A${r},${r},0,1,0,${cx + r},${cy}A${r},${r},0,1,0,${cx - r},${cy}Z`
    : null
}

function ellipseToD(element: Element): string | null {
  const cx = num(element, 'cx')
  const cy = num(element, 'cy')
  const rx = num(element, 'rx')
  const ry = num(element, 'ry')
  return rx > 0 && ry > 0
    ? `M${cx - rx},${cy}A${rx},${ry},0,1,0,${cx + rx},${cy}A${rx},${ry},0,1,0,${cx - rx},${cy}Z`
    : null
}

function rectToD(element: Element): string | null {
  const x = num(element, 'x')
  const y = num(element, 'y')
  const width = num(element, 'width')
  const height = num(element, 'height')
  if (width <= 0 || height <= 0) return null
  const rx = Math.min(num(element, 'rx'), width / 2)
  const ry = Math.min(num(element, 'ry', rx), height / 2)
  if (rx > 0 || ry > 0) {
    const arcX = rx || ry
    const arcY = ry || rx
    return `M${x + arcX},${y}H${x + width - arcX}A${arcX},${arcY},0,0,1,${x + width},${y + arcY}V${y + height - arcY}A${arcX},${arcY},0,0,1,${x + width - arcX},${y + height}H${x + arcX}A${arcX},${arcY},0,0,1,${x},${y + height - arcY}V${y + arcY}A${arcX},${arcY},0,0,1,${x + arcX},${y}Z`
  }
  return `M${x},${y}H${x + width}V${y + height}H${x}Z`
}

function pointsToD(element: Element, close: boolean): string | null {
  const points = element.getAttribute('points')
  if (!points) return null
  const values = points
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (values.length < 4 || values.length % 2 !== 0) return null
  let path = `M${values[0]},${values[1]}`
  for (let index = 2; index < values.length; index += 2) {
    path += `L${values[index]},${values[index + 1]}`
  }
  return close ? `${path}Z` : path
}

function shapeToD(tagName: string, element: Element): string | null {
  switch (tagName) {
    case 'circle':
      return circleToD(element)
    case 'ellipse':
      return ellipseToD(element)
    case 'rect':
      return rectToD(element)
    case 'line':
      return `M${num(element, 'x1')},${num(element, 'y1')}L${num(element, 'x2')},${num(element, 'y2')}`
    case 'polygon':
      return pointsToD(element, true)
    case 'polyline':
      return pointsToD(element, false)
    default:
      return null
  }
}

function combinedTransform(parent: string | null, element: Element): string | null {
  const current = element.getAttribute('transform')
  if (parent && current) return `${parent} ${current}`
  return current ?? parent
}

function collectPaths(
  element: Element,
  inherited: PresentationAttributes,
  parentTransform: string | null,
  result: IconPathInfo[]
): void {
  const tagName = element.localName || element.tagName
  if (NON_RENDERED_CONTAINERS.has(tagName)) return

  const presentation = presentationFor(element, inherited)
  const transform = combinedTransform(parentTransform, element)
  if (SHAPE_NAMES.has(tagName)) {
    const pathData = tagName === 'path' ? element.getAttribute('d') : shapeToD(tagName, element)
    if (pathData) {
      const strokeWidth = Number.parseFloat(presentation.strokeWidth)
      result.push({
        d: pathData,
        fill: presentation.fill === 'none' ? null : presentation.fill,
        stroke: presentation.stroke === 'none' ? null : presentation.stroke,
        strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : 1,
        strokeCap: presentation.strokeCap,
        strokeJoin: presentation.strokeJoin,
        fillRule: presentation.fillRule === 'evenodd' ? 'EVENODD' : 'NONZERO',
        transform
      })
    }
  }

  for (const child of Array.from(element.childNodes)) {
    if (isElement(child)) collectPaths(child, presentation, transform, result)
  }
}

export function extractPaths(svgBody: string): IconPathInfo[] {
  const root = parseSVGFragment(svgBody)?.documentElement
  if (!root) return []
  const result: IconPathInfo[] = []
  collectPaths(root, DEFAULT_PRESENTATION, null, result)
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
    height: iconEntry.height ?? defaultH
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
    paths: scalePathInfos(pathInfos, scaleX, scaleY)
  }
}

/** Scale extracted SVG path info into IconData paths (shared by buildIconData and design-jsx <svg>). */
export function scalePathInfos(
  pathInfos: IconPathInfo[],
  scaleX: number,
  scaleY: number
): IconData['paths'] {
  return pathInfos.map((path) => {
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
      strokeJoin: path.strokeJoin
    }
  })
}
