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

import type {
  IconData,
  IconifyIconEntry,
  IconPathInfo,
  SVGClipPathRegion,
  SVGElementLayer
} from './types'

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
  fillOpacity: string
  strokeOpacity: string
}

const DEFAULT_PRESENTATION: PresentationAttributes = {
  fill: 'currentColor',
  stroke: 'none',
  strokeWidth: '1',
  strokeCap: 'butt',
  strokeJoin: 'miter',
  fillRule: 'nonzero',
  fillOpacity: '1',
  strokeOpacity: '1'
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
    fillRule: inheritedAttribute(element, styles, 'fill-rule', inherited.fillRule),
    fillOpacity: inheritedAttribute(element, styles, 'fill-opacity', inherited.fillOpacity),
    strokeOpacity: inheritedAttribute(element, styles, 'stroke-opacity', inherited.strokeOpacity)
  }
}

/** An SVG opacity, a number or a percentage, clamped to 0–1. */
function opacityValue(value: string | null | undefined): number {
  if (!value) return 1
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return 1
  const opacity = value.trim().endsWith('%') ? parsed / 100 : parsed
  return Math.min(1, Math.max(0, opacity))
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

interface Traversal {
  root: Element
  elementsById: ReadonlyMap<string, Element>
  nextKey: number
}

/** What an element inherits from the elements around it. */
interface Scope {
  presentation: PresentationAttributes
  transform: string | null
  clipPaths: SVGClipPathRegion[]
  elements: SVGElementLayer[]
  useStack: ReadonlySet<Element>
  /** Drawn through `<use>` or inside a `<clipPath>`, so ids name the source, not this copy. */
  referenced: boolean
}

function elementLayer(
  traversal: Traversal,
  element: Element,
  kind: SVGElementLayer['kind'],
  scope: Pick<Scope, 'referenced'>,
  clip: number | null
): SVGElementLayer {
  return {
    key: traversal.nextKey++,
    kind,
    name: scope.referenced ? null : element.getAttribute('id') || null,
    opacity: opacityValue(inlineStyles(element).get('opacity') ?? element.getAttribute('opacity')),
    clip
  }
}

function appendShapePath(
  tagName: string,
  element: Element,
  scope: Scope,
  layer: SVGElementLayer,
  result: IconPathInfo[]
): void {
  const pathData = tagName === 'path' ? element.getAttribute('d') : shapeToD(tagName, element)
  if (!pathData) return
  const { presentation } = scope
  const strokeWidth = Number.parseFloat(presentation.strokeWidth)
  result.push({
    d: pathData,
    fill: normalizeSVGPaint(presentation.fill),
    stroke: normalizeSVGPaint(presentation.stroke),
    strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : 1,
    strokeCap: presentation.strokeCap,
    strokeJoin: presentation.strokeJoin,
    fillRule: presentation.fillRule === 'evenodd' ? 'EVENODD' : 'NONZERO',
    fillOpacity: opacityValue(presentation.fillOpacity),
    strokeOpacity: opacityValue(presentation.strokeOpacity),
    transform: scope.transform,
    clipPaths: scope.clipPaths.length > 0 ? scope.clipPaths : undefined,
    elements: [...scope.elements, layer]
  })
}

function collectUsePaths(
  element: Element,
  scope: Scope,
  traversal: Traversal,
  result: IconPathInfo[]
): void {
  const x = num(element, 'x')
  const y = num(element, 'y')
  const transform =
    x !== 0 || y !== 0 ? `${scope.transform ?? ''} translate(${x} ${y})`.trim() : scope.transform
  const href = element.getAttribute('href') ?? element.getAttribute('xlink:href')
  const target = href?.startsWith('#') ? traversal.elementsById.get(href.slice(1)) : null
  if (target && !scope.useStack.has(target)) {
    collectPaths(
      target,
      { ...scope, transform, useStack: new Set([...scope.useStack, target]), referenced: true },
      traversal,
      result
    )
  }
}

function collectClipPath(
  value: string | null,
  parentTransform: string | null,
  traversal: Traversal
): SVGClipPathRegion | null {
  const match = value?.trim().match(/^url\(\s*['"]?#([^'")\s]+)['"]?\s*\)$/)
  const target = match ? traversal.elementsById.get(match[1]) : null
  if (!match || !target || (target.localName || target.tagName) !== 'clipPath') return null

  const units =
    target.getAttribute('clipPathUnits') === 'objectBoundingBox'
      ? 'objectBoundingBox'
      : 'userSpaceOnUse'
  const paths: IconPathInfo[] = []
  collectPaths(
    target,
    {
      presentation: { ...DEFAULT_PRESENTATION, fill: '#000000' },
      transform: units === 'objectBoundingBox' ? null : parentTransform,
      clipPaths: [],
      elements: [],
      useStack: new Set([target]),
      referenced: true
    },
    traversal,
    paths
  )
  return {
    id: match[1],
    paths: paths.map(({ d, fillRule, transform }) => ({ d, fillRule, transform })),
    units
  }
}

function collectPaths(
  element: Element,
  inherited: Scope,
  traversal: Traversal,
  result: IconPathInfo[]
): void {
  const tagName = element.localName || element.tagName
  if (NON_RENDERED_CONTAINERS.has(tagName) && !inherited.referenced) return

  const transform = combinedTransform(inherited.transform, element)
  const ownClipPath = collectClipPath(element.getAttribute('clip-path'), transform, traversal)
  const clipPaths = ownClipPath ? [...inherited.clipPaths, ownClipPath] : inherited.clipPaths
  const clip = ownClipPath ? clipPaths.length - 1 : null
  const scope: Scope = {
    ...inherited,
    presentation: presentationFor(element, inherited.presentation),
    transform,
    clipPaths
  }

  if (SHAPE_NAMES.has(tagName)) {
    appendShapePath(
      tagName,
      element,
      scope,
      elementLayer(traversal, element, 'shape', scope, clip),
      result
    )
    return
  }
  // A group is a layer; another container only becomes one to keep its clip or opacity.
  const layer = elementLayer(traversal, element, 'group', scope, clip)
  const isLayer =
    tagName === 'g' || clip !== null || (layer.opacity !== 1 && element !== traversal.root)
  const childScope = isLayer ? { ...scope, elements: [...scope.elements, layer] } : scope
  if (tagName === 'use') {
    collectUsePaths(element, childScope, traversal, result)
    return
  }
  for (const child of Array.from(element.childNodes)) {
    if (isElement(child)) collectPaths(child, childScope, traversal, result)
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
  collectPaths(
    root,
    {
      presentation: DEFAULT_PRESENTATION,
      transform: null,
      clipPaths: [],
      elements: [],
      useStack: new Set(),
      referenced: false
    },
    { root, elementsById, nextKey: 0 },
    result
  )
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
    const fill = normalizeSVGPaint(path.fill)
    const stroke = normalizeSVGPaint(path.stroke)
    return {
      // A stroke would also trace the closing edge of an open subpath in the fill region.
      vectorNetwork: parseSVGPath(scaledD, path.fillRule, {
        includeOpenRegions: fill !== null && stroke === null
      }),
      fill,
      stroke,
      strokeWidth:
        path.strokeWidth * transformStrokeScale(path.transform) * Math.min(scaleX, scaleY),
      strokeCap: path.strokeCap,
      strokeJoin: path.strokeJoin
    }
  })
}
