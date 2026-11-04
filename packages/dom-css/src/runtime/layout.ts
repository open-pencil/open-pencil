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
        texts.push(...lineTextNodes(child, view))
      }
    }
  }
  return texts
}

/** Rects of text on one line overlap vertically; each line is the union of its rects. */
function groupIntoLines(rects: DOMRectReadOnly[]): DOMRect[] {
  const sorted = [...rects].sort((a, b) => a.top - b.top || a.left - b.left)
  const lines: DOMRect[] = []
  for (const rect of sorted) {
    const line = lines.find((candidate) => {
      const overlap = Math.min(candidate.bottom, rect.bottom) - Math.max(candidate.top, rect.top)
      return overlap > Math.min(candidate.height, rect.height) / 2
    })
    if (!line) {
      lines.push(DOMRect.fromRect(rect))
      continue
    }
    const left = Math.min(line.left, rect.left)
    const top = Math.min(line.top, rect.top)
    const right = Math.max(line.right, rect.right)
    const bottom = Math.max(line.bottom, rect.bottom)
    line.x = left
    line.y = top
    line.width = right - left
    line.height = bottom - top
  }
  return lines.sort((a, b) => a.top - b.top)
}

function lineRects(element: Element, view: DocumentView): DOMRect[] {
  const document = element.ownerDocument
  const rects = lineTextNodes(element, view).flatMap((text) => {
    const range = document.createRange()
    range.selectNodeContents(text)
    return Array.from(range.getClientRects()).filter(hasArea)
  })
  return groupIntoLines(rects)
}

function measureElement(
  element: Element,
  origin: DOMRectReadOnly,
  view: DocumentView
): DesignLayout {
  const layout: DesignLayout = { box: toRect(element.getBoundingClientRect(), origin) }
  if (isInlineFlow(view.getComputedStyle(element).display)) {
    const fragments = Array.from(element.getClientRects()).filter(hasArea)
    if (fragments.length > 0) layout.fragments = fragments.map((rect) => toRect(rect, origin))
    return layout
  }
  const lines = lineRects(element, view)
  if (lines.length > 0) layout.lines = lines.map((rect) => toRect(rect, origin))
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
    for (const [designElement, domElement] of pairs) {
      designElement.layout = measureElement(domElement, originRect, view)
    }
  } finally {
    untransformed.remove()
  }
}
