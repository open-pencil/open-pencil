import { appendAll } from '@open-pencil/scene-graph/arrays'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { DesignElement, DesignLayout } from '../types'

/** The window of the sandboxed document, whose `Text` and `Element` its nodes are instances of. */
type DocumentView = Window & typeof globalThis

/**
 * Transforms move what is drawn, not the layout, so they are switched off while boxes are read;
 * transitions and animations too, so switching them off does not animate.
 */
const UNTRANSFORMED_CSS =
  '*,*::before,*::after{transform:none!important;translate:none!important;rotate:none!important;' +
  'scale:none!important;transition:none!important;animation:none!important}'

/** Display values whose box flows in a line, so its text belongs to the lines around it. */
function isInlineFlow(display: string): boolean {
  return display === 'inline' || display === 'contents'
}

function toRect(rect: DOMRectReadOnly, origin: DOMRectReadOnly): Rect {
  return {
    x: rect.left - origin.left,
    y: rect.top - origin.top,
    width: rect.width,
    height: rect.height
  }
}

function hasArea(rect: DOMRectReadOnly): boolean {
  return rect.width > 0 && rect.height > 0
}

/** The text nodes an element lays out in its own lines: its own, and its inline descendants'. */
function lineTextNodes(element: Element, view: DocumentView): Text[] {
  const texts: Text[] = []
  for (const child of Array.from(element.childNodes)) {
    if (child instanceof view.Text) {
      if (child.data.trim().length > 0) texts.push(child)
    } else if (child instanceof view.Element) {
      if (isInlineFlow(view.getComputedStyle(child).display)) {
        appendAll(texts, lineTextNodes(child, view))
      }
    }
  }
  return texts
}

/** Rects of text on one line overlap vertically by more than half; each line spans its rects. */
function groupIntoLines(rects: readonly Rect[]): Rect[] {
  const lines: Rect[][] = []
  for (const rect of [...rects].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const line = lines.find((group) => {
      const span = computeBounds(group)
      const overlap =
        Math.min(span.y + span.height, rect.y + rect.height) - Math.max(span.y, rect.y)
      return overlap > Math.min(span.height, rect.height) / 2
    })
    if (line) line.push(rect)
    else lines.push([rect])
  }
  return lines.map((group) => computeBounds(group))
}

/** The properties that decide where a run's glyphs sit in its line box, and how tall that is. */
const LINE_FONT_PROPERTIES = [
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-stretch',
  'line-height'
] as const

/** Where a run's line box is relative to the area its glyphs cover, which is what a range reports. */
interface LineBoxOffset {
  /** How far above the glyphs the line box starts: half the leading, as the browser rounds it. */
  above: number
  height: number
}

/** The line box offset of a run of text set in an element's font, by the element. */
type LineBoxOffsets = (element: Element, sample: string) => LineBoxOffset

/**
 * Measures line box offsets on one line set in each font and line height, appended to `host`,
 * so they round as the browser rounds the leading, and remembers them per font.
 */
function lineBoxOffsets(host: Element, view: DocumentView): LineBoxOffsets {
  const document = host.ownerDocument
  const known = new Map<string, LineBoxOffset>()
  return (element, sample) => {
    const style = view.getComputedStyle(element)
    const font = LINE_FONT_PROPERTIES.map((property) => style.getPropertyValue(property))
    const key = [...font, sample].join('|')
    const remembered = known.get(key)
    if (remembered) return remembered
    const line = document.createElement('div')
    line.style.cssText =
      'position:absolute;left:0;top:0;margin:0;padding:0;border:0;white-space:pre;visibility:hidden'
    for (const [index, property] of LINE_FONT_PROPERTIES.entries()) {
      line.style.setProperty(property, font[index])
    }
    const text = document.createTextNode(sample)
    line.append(text)
    host.append(line)
    const range = document.createRange()
    range.selectNodeContents(text)
    const glyphs = range.getBoundingClientRect()
    const box = line.getBoundingClientRect()
    line.remove()
    const offset = { above: glyphs.top - box.top, height: box.height }
    known.set(key, offset)
    return offset
  }
}

/**
 * The characters a run's line box is measured with: a Latin letter, or the run's first character
 * where that is not ASCII, since a fallback font sets it with metrics of its own.
 */
function sampleOf(text: string): string {
  const first = text.trim().charAt(0)
  return first && first.charCodeAt(0) > 0x7f ? first : 'x'
}

/** The line boxes of the text an element lays out, each around the runs it sets. */
function lineRects(
  element: Element,
  origin: DOMRectReadOnly,
  view: DocumentView,
  offsets: LineBoxOffsets
): Rect[] {
  const document = element.ownerDocument
  const rects = lineTextNodes(element, view).flatMap((text) => {
    const range = document.createRange()
    range.selectNodeContents(text)
    const glyphs = Array.from(range.getClientRects()).filter(hasArea)
    if (glyphs.length === 0 || !text.parentElement) return []
    const { above, height } = offsets(text.parentElement, sampleOf(text.data))
    return glyphs.map((rect) => {
      const run = toRect(rect, origin)
      return { ...run, y: run.y - above, height }
    })
  })
  return groupIntoLines(rects)
}

function measureElement(
  element: Element,
  origin: DOMRectReadOnly,
  view: DocumentView,
  offsets: LineBoxOffsets
): DesignLayout {
  const layout: DesignLayout = { box: toRect(element.getBoundingClientRect(), origin) }
  if (isInlineFlow(view.getComputedStyle(element).display)) {
    const fragments = Array.from(element.getClientRects()).filter(hasArea)
    if (fragments.length > 0) layout.fragments = fragments.map((rect) => toRect(rect, origin))
    return layout
  }
  const lines = lineRects(element, origin, view, offsets)
  if (lines.length > 0) layout.lines = lines
  return layout
}

/**
 * Records where each element is laid out, relative to `origin`'s top-left. `styleRoot` receives
 * the stylesheet that switches transforms off while the boxes are read.
 */
export function recordLayout(
  pairs: readonly [DesignElement, Element][],
  origin: Element,
  styleRoot: Node & ParentNode
): void {
  const document = origin.ownerDocument
  const view = document.defaultView
  if (!view) throw new TypeError('Browser CSS runtime requires a window to read layout')
  const untransformed = document.createElement('style')
  untransformed.textContent = UNTRANSFORMED_CSS
  styleRoot.append(untransformed)
  try {
    const originRect = origin.getBoundingClientRect()
    const offsets = lineBoxOffsets(origin, view)
    for (const [designElement, domElement] of pairs) {
      designElement.layout = measureElement(domElement, originRect, view, offsets)
    }
  } finally {
    untransformed.remove()
  }
}
