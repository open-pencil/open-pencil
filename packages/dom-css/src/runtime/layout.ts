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

/** A run of text on one line: its inline box, and where its baseline is. */
interface Run {
  box: Rect
  baseline: number
}

/** Runs on one line overlap vertically by more than half, so they group into lines. */
function groupIntoLines(runs: readonly Run[]): Run[][] {
  const lines: Run[][] = []
  for (const run of [...runs].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)) {
    const line = lines.find((group) => {
      const span = computeBounds(group.map((member) => member.box))
      const overlap =
        Math.min(span.y + span.height, run.box.y + run.box.height) - Math.max(span.y, run.box.y)
      return overlap > Math.min(span.height, run.box.height) / 2
    })
    if (line) line.push(run)
    else lines.push([run])
  }
  return lines
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

/** A line box set in one font and line height, relative to its top. */
interface LineMetrics {
  /** Where the glyphs start, which is where a range reports them: half the leading, rounded. */
  glyphs: number
  baseline: number
  height: number
}

interface LineMeasure {
  /** The line box of text set in an element's font, by its element and a sample of the text. */
  metrics: (element: Element, sample: string) => LineMetrics
  remove: () => void
}

/**
 * Measures line boxes on one line set in each font and line height, so they round as the browser
 * rounds the leading, and remembers them per font. The line is laid out in a shadow root of its
 * own, which the page's stylesheets do not reach, with only its font set.
 */
function lineMeasure(host: Element, view: DocumentView): LineMeasure {
  const document = host.ownerDocument
  const probe = document.createElement('openpencil-line-probe')
  probe.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;visibility:hidden'
  const root = probe.attachShadow({ mode: 'open' })
  host.append(probe)
  const known = new Map<string, LineMetrics>()
  const metrics = (element: Element, sample: string): LineMetrics => {
    const style = view.getComputedStyle(element)
    const font = LINE_FONT_PROPERTIES.map((property) => style.getPropertyValue(property))
    const key = [...font, sample].join('|')
    const remembered = known.get(key)
    if (remembered) return remembered
    const line = document.createElement('div')
    line.style.cssText = 'all:initial;display:block;white-space:pre'
    for (const [index, property] of LINE_FONT_PROPERTIES.entries()) {
      line.style.setProperty(property, font[index])
    }
    const text = document.createTextNode(sample)
    // An empty inline-block sits with its bottom on the baseline.
    const baseline = document.createElement('span')
    baseline.style.cssText = 'all:initial;display:inline-block;width:0;height:0'
    line.append(text, baseline)
    root.append(line)
    const range = document.createRange()
    range.selectNodeContents(text)
    const top = line.getBoundingClientRect().top
    const measured = {
      glyphs: range.getBoundingClientRect().top - top,
      baseline: baseline.getBoundingClientRect().bottom - top,
      height: line.getBoundingClientRect().height
    }
    line.remove()
    known.set(key, measured)
    return measured
  }
  return { metrics, remove: () => probe.remove() }
}

/**
 * The characters a run's line box is measured with: a Latin letter, or the run's first character
 * where that is not ASCII, since a fallback font sets it with metrics of its own.
 */
function sampleOf(text: string): string {
  const first = text.trim().charAt(0)
  return first && first.charCodeAt(0) > 0x7f ? first : 'x'
}

/**
 * The line boxes of the text an element lays out. Each is around the inline boxes of the runs it
 * sets, and at least the element's own line box, its strut, on the same baseline, as CSS sets a
 * line no shorter than the block's line height however small its runs' are.
 */
function lineRects(
  element: Element,
  origin: DOMRectReadOnly,
  view: DocumentView,
  measure: LineMeasure
): Rect[] {
  const document = element.ownerDocument
  const runs = lineTextNodes(element, view).flatMap((text): Run[] => {
    const range = document.createRange()
    range.selectNodeContents(text)
    const glyphs = Array.from(range.getClientRects()).filter(hasArea)
    if (glyphs.length === 0 || !text.parentElement) return []
    const font = measure.metrics(text.parentElement, sampleOf(text.data))
    return glyphs.map((rect) => {
      const glyphBox = toRect(rect, origin)
      const top = glyphBox.y - font.glyphs
      return { box: { ...glyphBox, y: top, height: font.height }, baseline: top + font.baseline }
    })
  })
  if (runs.length === 0) return []
  const strut = measure.metrics(element, 'x')
  return groupIntoLines(runs).map((line) => {
    const span = computeBounds(line.map((run) => run.box))
    const strutTop = line[0].baseline - strut.baseline
    const top = Math.min(span.y, strutTop)
    const bottom = Math.max(span.y + span.height, strutTop + strut.height)
    return { x: span.x, y: top, width: span.width, height: bottom - top }
  })
}

function measureElement(
  element: Element,
  origin: DOMRectReadOnly,
  view: DocumentView,
  measure: LineMeasure
): DesignLayout {
  const layout: DesignLayout = { box: toRect(element.getBoundingClientRect(), origin) }
  if (isInlineFlow(view.getComputedStyle(element).display)) {
    const fragments = Array.from(element.getClientRects()).filter(hasArea)
    if (fragments.length > 0) layout.fragments = fragments.map((rect) => toRect(rect, origin))
    return layout
  }
  const lines = lineRects(element, origin, view, measure)
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
  const measure = lineMeasure(origin, view)
  try {
    const originRect = origin.getBoundingClientRect()
    for (const [designElement, domElement] of pairs) {
      designElement.layout = measureElement(domElement, originRect, view, measure)
    }
  } finally {
    measure.remove()
    untransformed.remove()
  }
}
