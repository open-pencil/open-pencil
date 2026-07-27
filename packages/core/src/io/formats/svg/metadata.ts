import type { Element } from '@xmldom/xmldom'

import type { Rect, Size } from '@open-pencil/scene-graph/primitives'

import { parseSVGDocument } from './document'

function rootElement(svg: string): Element | null {
  return parseSVGDocument(svg)?.documentElement ?? null
}

function parseViewBoxValue(value: string | null): Rect | null {
  if (!value) return null
  const values = value
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (values.length !== 4 || values.some((entry) => !Number.isFinite(entry))) return null
  const [x = 0, y = 0, width = 0, height = 0] = values
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

export function parseSVGViewBox(svg: string): Rect | null {
  return parseViewBoxValue(rootElement(svg)?.getAttribute('viewBox') ?? null)
}

function parseSVGDimension(root: Element | null, attribute: string): number | null {
  const value = root?.getAttribute(attribute)
  if (!value) return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function parseSVGSize(svg: string, fallback: Size = { width: 24, height: 24 }): Size {
  const root = rootElement(svg)
  const viewBox = parseViewBoxValue(root?.getAttribute('viewBox') ?? null)
  const width = parseSVGDimension(root, 'width')
  const height = parseSVGDimension(root, 'height')
  if (width && height) return { width, height }
  if (viewBox) return { width: viewBox.width, height: viewBox.height }
  return fallback
}
