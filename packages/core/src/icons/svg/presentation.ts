import type { Element, Node } from '@xmldom/xmldom'

/** SVG presentation attributes as an element inherits them, still as source strings. */
export interface PresentationAttributes {
  fill: string
  stroke: string
  strokeWidth: string
  strokeCap: string
  strokeJoin: string
  fillRule: string
  fillOpacity: string
  strokeOpacity: string
  fontFamily: string
  fontSize: string
  fontWeight: string
  fontStyle: string
  textAnchor: string
  letterSpacing: string
  textDecoration: string
}

export const DEFAULT_PRESENTATION: PresentationAttributes = {
  fill: 'currentColor',
  stroke: 'none',
  strokeWidth: '1',
  strokeCap: 'butt',
  strokeJoin: 'miter',
  fillRule: 'nonzero',
  fillOpacity: '1',
  strokeOpacity: '1',
  fontFamily: '',
  fontSize: '',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAnchor: 'start',
  letterSpacing: 'normal',
  textDecoration: 'none'
}

export function isElement(node: Node): node is Element {
  return node.nodeType === node.ELEMENT_NODE
}

export function inlineStyles(element: Element): ReadonlyMap<string, string> {
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

export function presentationFor(
  element: Element,
  inherited: PresentationAttributes
): PresentationAttributes {
  const styles = inlineStyles(element)
  const attribute = (name: string, value: string) =>
    inheritedAttribute(element, styles, name, value)
  return {
    fill: attribute('fill', inherited.fill),
    stroke: attribute('stroke', inherited.stroke),
    strokeWidth: attribute('stroke-width', inherited.strokeWidth),
    strokeCap: attribute('stroke-linecap', inherited.strokeCap),
    strokeJoin: attribute('stroke-linejoin', inherited.strokeJoin),
    fillRule: attribute('fill-rule', inherited.fillRule),
    fillOpacity: attribute('fill-opacity', inherited.fillOpacity),
    strokeOpacity: attribute('stroke-opacity', inherited.strokeOpacity),
    fontFamily: attribute('font-family', inherited.fontFamily),
    fontSize: attribute('font-size', inherited.fontSize),
    fontWeight: attribute('font-weight', inherited.fontWeight),
    fontStyle: attribute('font-style', inherited.fontStyle),
    textAnchor: attribute('text-anchor', inherited.textAnchor),
    letterSpacing: attribute('letter-spacing', inherited.letterSpacing),
    textDecoration: attribute('text-decoration', inherited.textDecoration)
  }
}

/** An SVG opacity, a number or a percentage, clamped to 0–1. */
export function opacityValue(value: string | null | undefined): number {
  if (!value) return 1
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return 1
  const opacity = value.trim().endsWith('%') ? parsed / 100 : parsed
  return Math.min(1, Math.max(0, opacity))
}

export function num(element: Element, attr: string, fallback = 0): number {
  const value = element.getAttribute(attr)
  if (value === null) return fallback
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function normalizeSVGPaint(value: string | null): string | null {
  return value?.trim().toLowerCase() === 'none' ? null : value
}

export function combinedTransform(parent: string | null, element: Element): string | null {
  const current = element.getAttribute('transform')
  if (parent && current) return `${parent} ${current}`
  return current ?? parent
}
