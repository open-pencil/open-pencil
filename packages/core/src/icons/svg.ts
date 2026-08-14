import { iconToSVG } from '@iconify/utils'
import {
  DOMImplementation,
  type Document as XMLDocument,
  type Element,
  type Node
} from '@xmldom/xmldom'
import svgpath from 'svgpath'

import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { parseSVGFragment } from '#core/io/formats/svg/document'

import type { IconData, IconifyIconEntry, IconPathInfo, SVGClipPathRegion } from './types'

interface SVGElementInput {
  type: string
  props: Readonly<Record<string, unknown>>
  children: readonly (SVGElementInput | string)[]
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const JSX_ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
  className: 'class',
  fillRule: 'fill-rule',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeWidth: 'stroke-width',
  xlinkHref: 'xlink:href'
}

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

function inlineStyles(element: Element): ReadonlyMap<string, string> {
  const styles = new Map<string, string>()
  for (const declaration of (element.getAttribute('style') ?? '').split(';')) {
    const separator = declaration.indexOf(':')
    if (separator <= 0) continue
    const name = declaration.slice(0, separator).trim()
    const value = declaration.slice(separator + 1).trim()
    if (name && value) styles.set(name, value)
  }
  return styles
}

function inheritedAttribute(
  element: Element,
  styles: ReadonlyMap<string, string>,
  name: string,
  inherited: string
): string {
  return (
    styles.get(name) ??
    (element.hasAttribute(name) ? (element.getAttribute(name) ?? inherited) : inherited)
  )
}

function presentationFor(
  element: Element,
  inherited: PresentationAttributes
): PresentationAttributes {
  const styles = inlineStyles(element)
  return {
    fill: inheritedAttribute(element, styles, 'fill', inherited.fill),
    stroke: inheritedAttribute(element, styles, 'stroke', inherited.stroke),
    strokeWidth: inheritedAttribute(element, styles, 'stroke-width', inherited.strokeWidth),
    strokeCap: inheritedAttribute(element, styles, 'stroke-linecap', inherited.strokeCap),
    strokeJoin: inheritedAttribute(element, styles, 'stroke-linejoin', inherited.strokeJoin),
    fillRule: inheritedAttribute(element, styles, 'fill-rule', inherited.fillRule)
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

function normalizeSVGPaint(value: string | null): string | null {
  return value?.trim().toLowerCase() === 'none' ? null : value
}

function appendShapePath(
  tagName: string,
  element: Element,
  presentation: PresentationAttributes,
  transform: string | null,
  clipPaths: SVGClipPathRegion[],
  result: IconPathInfo[]
): void {
  if (!SHAPE_NAMES.has(tagName)) return
  const pathData = tagName === 'path' ? element.getAttribute('d') : shapeToD(tagName, element)
  if (!pathData) return
  const strokeWidth = Number.parseFloat(presentation.strokeWidth)
  result.push({
    d: pathData,
    fill: normalizeSVGPaint(presentation.fill),
    stroke: normalizeSVGPaint(presentation.stroke),
    strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : 1,
    strokeCap: presentation.strokeCap,
    strokeJoin: presentation.strokeJoin,
    fillRule: presentation.fillRule === 'evenodd' ? 'EVENODD' : 'NONZERO',
    transform,
    clipPaths: clipPaths.length > 0 ? clipPaths : undefined
  })
}

function collectUsePaths(
  element: Element,
  presentation: PresentationAttributes,
  transform: string | null,
  result: IconPathInfo[],
  elementsById: ReadonlyMap<string, Element>,
  useStack: ReadonlySet<Element>,
  clipPaths: SVGClipPathRegion[]
): boolean {
  const tagName = element.localName || element.tagName
  if (tagName !== 'use') return false
  const x = num(element, 'x')
  const y = num(element, 'y')
  const useTransform =
    x !== 0 || y !== 0 ? `${transform ?? ''} translate(${x} ${y})`.trim() : transform
  const href = element.getAttribute('href') ?? element.getAttribute('xlink:href')
  const target = href?.startsWith('#') ? elementsById.get(href.slice(1)) : null
  if (target && !useStack.has(target)) {
    collectPaths(
      target,
      presentation,
      useTransform,
      result,
      elementsById,
      new Set([...useStack, target]),
      true,
      clipPaths
    )
  }
  return true
}

function collectClipPath(
  value: string | null,
  parentTransform: string | null,
  elementsById: ReadonlyMap<string, Element>
): SVGClipPathRegion | null {
  const match = value?.trim().match(/^url\(\s*['"]?#([^'")\s]+)['"]?\s*\)$/)
  const target = match ? elementsById.get(match[1]) : null
  if (!target || (target.localName || target.tagName) !== 'clipPath') return null

  const units =
    target.getAttribute('clipPathUnits') === 'objectBoundingBox'
      ? 'objectBoundingBox'
      : 'userSpaceOnUse'
  const paths: IconPathInfo[] = []
  collectPaths(
    target,
    { ...DEFAULT_PRESENTATION, fill: '#000000' },
    units === 'objectBoundingBox' ? null : parentTransform,
    paths,
    elementsById,
    new Set([target]),
    true
  )
  return {
    paths: paths.map(({ d, fillRule, transform }) => ({ d, fillRule, transform })),
    units
  }
}

function collectPaths(
  element: Element,
  inherited: PresentationAttributes,
  parentTransform: string | null,
  result: IconPathInfo[],
  elementsById: ReadonlyMap<string, Element>,
  useStack: ReadonlySet<Element> = new Set(),
  referenced = false,
  inheritedClipPaths: SVGClipPathRegion[] = []
): void {
  const tagName = element.localName || element.tagName
  if (NON_RENDERED_CONTAINERS.has(tagName) && !referenced) return

  const presentation = presentationFor(element, inherited)
  const transform = combinedTransform(parentTransform, element)
  const ownClipPath = collectClipPath(element.getAttribute('clip-path'), transform, elementsById)
  const clipPaths = ownClipPath ? [...inheritedClipPaths, ownClipPath] : inheritedClipPaths
  if (collectUsePaths(element, presentation, transform, result, elementsById, useStack, clipPaths))
    return
  appendShapePath(tagName, element, presentation, transform, clipPaths, result)

  for (const child of Array.from(element.childNodes)) {
    if (isElement(child)) {
      collectPaths(
        child,
        presentation,
        transform,
        result,
        elementsById,
        useStack,
        referenced,
        clipPaths
      )
    }
  }
}

function appendSVGElement(svgDocument: XMLDocument, parent: Element, input: SVGElementInput): void {
  if (!/^[A-Za-z][\w:.-]*$/.test(input.type)) return
  const element = svgDocument.createElementNS(SVG_NAMESPACE, input.type)
  for (const [propName, value] of Object.entries(input.props)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue
    const attributeName = JSX_ATTRIBUTE_NAMES[propName] ?? propName
    element.setAttribute(attributeName, String(value))
  }
  if (input.type === 'path' && !element.hasAttribute('d') && typeof input.props.body === 'string') {
    element.setAttribute('d', input.props.body)
  }
  for (const child of input.children) {
    if (typeof child !== 'string') appendSVGElement(svgDocument, element, child)
  }
  parent.appendChild(element)
}

function collectDocumentPaths(root: Element): IconPathInfo[] {
  const elementsById = new Map<string, Element>()
  for (const element of Array.from(root.getElementsByTagName('*'))) {
    const id = element.getAttribute('id')
    if (id) elementsById.set(id, element)
  }
  const result: IconPathInfo[] = []
  collectPaths(root, DEFAULT_PRESENTATION, null, result, elementsById)
  return result
}

export function extractPathsFromElements(
  elements: readonly SVGElementInput[],
  rootProps: Readonly<Record<string, unknown>> = {}
): IconPathInfo[] {
  const svgDocument = new DOMImplementation().createDocument(SVG_NAMESPACE, 'svg')
  const root = svgDocument.documentElement
  if (!root) return []
  appendSVGElement(svgDocument, root, { type: 'svg', props: rootProps, children: elements })
  return collectDocumentPaths(root)
}

export function extractPaths(svgBody: string): IconPathInfo[] {
  const root = parseSVGFragment(svgBody)?.documentElement
  return root ? collectDocumentPaths(root) : []
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

function transformStrokeScale(transform: string | null | undefined): number {
  if (!transform || transform === 'none') return 1

  const points: Vector[] = []
  svgpath('M0 0 L1 0 M0 0 L0 1')
    .transform(transform)
    .abs()
    .iterate((segment) => {
      if (segment[0] === 'M' || segment[0] === 'L') {
        points.push({ x: segment[1], y: segment[2] })
      }
    })
  if (points.length < 4) return 1

  const xScale = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
  const yScale = Math.hypot(points[3].x - points[2].x, points[3].y - points[2].y)
  return Math.min(xScale, yScale)
}

/** Scale extracted SVG path info into IconData paths (shared by buildIconData and design-jsx <svg>). */
export function scalePathInfos(
  pathInfos: IconPathInfo[],
  scaleX: number,
  scaleY: number
): IconData['paths'] {
  return pathInfos.map((path) => {
    let transformedPath = svgpath(path.d)
    if (path.transform && path.transform !== 'none') {
      transformedPath = transformedPath.transform(path.transform)
    }
    if (scaleX !== 1 || scaleY !== 1) transformedPath = transformedPath.scale(scaleX, scaleY)
    const scaledD = transformedPath.round(2).toString()
    return {
      vectorNetwork: parseSVGPath(scaledD, path.fillRule),
      fill: normalizeSVGPaint(path.fill),
      stroke: normalizeSVGPaint(path.stroke),
      strokeWidth:
        path.strokeWidth * transformStrokeScale(path.transform) * Math.min(scaleX, scaleY),
      strokeCap: path.strokeCap,
      strokeJoin: path.strokeJoin
    }
  })
}
