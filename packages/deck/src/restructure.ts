import type { GUID, NodeChange, Vector } from '@open-pencil/kiwi/fig/codec'

import { comparePosition, guidKey, nextLocalId, nodeKey } from './guid'
import { pickCarriedSlideFields } from './slide-fields'

const SCAFFOLDING_TYPES = new Set(['SLIDE_GRID', 'SLIDE_ROW', 'MODULE'])
const INTERNAL_CANVAS_NAME = /internal\s*only/i
const DEFAULT_SLIDE_SIZE: Vector = { x: 1920, y: 1080 }
/**
 * Figma Slides presentation artboard rounding. Source SLIDE nodes often have no
 * cornerRadius; the rounded white card is applied when baking to a FRAME.
 */
const SLIDE_CORNER_RADIUS = 15

function buildChildrenMap(nodes: NodeChange[]): Map<string, NodeChange[]> {
  const map = new Map<string, NodeChange[]>()
  for (const nc of nodes) {
    const parent = guidKey(nc.parentIndex?.guid)
    if (!parent) continue
    const list = map.get(parent)
    if (list) list.push(nc)
    else map.set(parent, [nc])
  }
  for (const list of map.values()) {
    list.sort((a, b) => comparePosition(a.parentIndex?.position, b.parentIndex?.position))
  }
  return map
}

function isActiveSlide(nc: NodeChange): boolean {
  return nc.type === 'SLIDE' && nc.phase !== 'REMOVED'
}

/** Walk SLIDE_GRID → rows → slides (and MODULE wrappers) in tree order. */
export function collectActiveSlides(nodeChanges: NodeChange[]): NodeChange[] {
  const children = buildChildrenMap(nodeChanges)

  const slides: NodeChange[] = []
  const seen = new Set<string>()

  function visitSlideLike(nc: NodeChange) {
    if (isActiveSlide(nc)) {
      const key = nodeKey(nc)
      if (key && !seen.has(key)) {
        seen.add(key)
        slides.push(nc)
      }
      return
    }
    if (nc.type !== 'MODULE') return
    const key = nodeKey(nc)
    if (!key) return
    for (const child of children.get(key) ?? []) visitSlideLike(child)
  }

  const grids = nodeChanges
    .filter((n) => n.type === 'SLIDE_GRID' && n.phase !== 'REMOVED')
    .sort((a, b) => comparePosition(a.parentIndex?.position, b.parentIndex?.position))

  for (const grid of grids) {
    const gridKey = nodeKey(grid)
    if (!gridKey) continue
    for (const row of children.get(gridKey) ?? []) {
      if (row.type !== 'SLIDE_ROW' && row.type !== 'MODULE') {
        visitSlideLike(row)
        continue
      }
      const rowKey = nodeKey(row)
      if (!rowKey) continue
      for (const child of children.get(rowKey) ?? []) visitSlideLike(child)
    }
  }

  for (const nc of nodeChanges) {
    if (!isActiveSlide(nc)) continue
    const key = nodeKey(nc)
    if (key && !seen.has(key)) {
      seen.add(key)
      slides.push(nc)
    }
  }

  return slides
}

function fractionalPosition(index: number): string {
  if (index < 90) return String.fromCharCode(0x21 + index)
  return `!${index.toString(36)}`
}

function findDocument(nodeChanges: NodeChange[]): NodeChange {
  const document =
    nodeChanges.find((n) => n.type === 'DOCUMENT') ?? nodeChanges.find((n) => nodeKey(n) === '0:0')
  if (!document?.guid) {
    throw new Error('Deck restructure failed: missing DOCUMENT node')
  }
  return document
}

function collectInternalCanvases(nodeChanges: NodeChange[], docGuid: GUID): NodeChange[] {
  const out: NodeChange[] = []
  for (const nc of nodeChanges) {
    if (nc.type !== 'CANVAS' || nc.phase === 'REMOVED') continue
    const name = nc.name ?? ''
    if (!INTERNAL_CANVAS_NAME.test(name) && !nc.internalOnly) continue
    const clone = structuredClone(nc)
    clone.internalOnly = true
    clone.parentIndex = {
      guid: docGuid,
      position: clone.parentIndex?.position ?? '~'
    }
    out.push(clone)
  }
  return out
}

function slideSize(slide: NodeChange): Vector {
  const size = slide.size
  if (size != null && size.x > 0 && size.y > 0) return { x: size.x, y: size.y }
  return { ...DEFAULT_SLIDE_SIZE }
}

function whiteFill(): NonNullable<NodeChange['fillPaints']> {
  return [
    {
      type: 'SOLID',
      color: { r: 1, g: 1, b: 1, a: 1 },
      opacity: 1,
      visible: true
    }
  ]
}

/**
 * Convert deck NodeChanges into design-shaped NodeChanges:
 *
 * - One CANVAS page per active SLIDE (navigation / filmstrip only — no artboard fill)
 * - Exactly one white FRAME per page at slide size (default 1920×1080) — the only rectangle
 * - Slide content reparented under that FRAME
 * - Scaffolding elided; internal canvas marked internalOnly
 *
 * Viewport backdrop (dark grey) is applied by the editor, not by a second canvas node.
 */
export function restructureDeckNodeChanges(nodeChanges: NodeChange[]): NodeChange[] {
  if (nodeChanges.length === 0) return nodeChanges

  const slides = collectActiveSlides(nodeChanges)
  if (slides.length === 0) {
    return nodeChanges.map((nc) => structuredClone(nc))
  }

  const document = findDocument(nodeChanges)
  const docGuid = document.guid as GUID
  const slideKeys = new Set(slides.map((s) => nodeKey(s)).filter((k): k is string => k !== null))

  let localId = nextLocalId(nodeChanges)
  const alloc = (): GUID => ({ sessionID: 0, localID: localId++ })

  /** Old slide guid → new artboard FRAME guid (content reparent target). */
  const slideToFrame = new Map<string, GUID>()
  /** Old slide guid → page CANVAS guid. */
  const slideToPage = new Map<string, GUID>()

  const out: NodeChange[] = [structuredClone(document)]
  out.push(...collectInternalCanvases(nodeChanges, docGuid))

  slides.forEach((slide, index) => {
    const slideKey = nodeKey(slide)
    if (!slideKey || !slide.guid) return

    // The artboard FRAME *is* the slide: it carries the slide's size, fills and
    // children, so it keeps the slide's own guid. Export reads that guid back, which
    // is what closes the round trip — minting a fresh one here renumbered every slide
    // on every open, and the file re-uploaded on close with zero edits. It also leaves
    // content parent references pointing at a guid that still exists.
    const pageGuid = alloc()
    const frameGuid = slide.guid
    slideToPage.set(slideKey, pageGuid)
    slideToFrame.set(slideKey, frameGuid)

    const size = slideSize(slide)

    // Page = navigable container only (not a second visible canvas artboard). Slide-only
    // fields ride on it so they survive as raw fig fields and can be restored on export.
    out.push({
      ...pickCarriedSlideFields(slide),
      guid: pageGuid,
      type: 'CANVAS',
      name: slide.name ?? String(index + 1),
      phase: 'CREATED',
      parentIndex: { guid: docGuid, position: fractionalPosition(index) },
      visible: true,
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    })

    // The single 1920×1080 (or slide-sized) white rectangle in the viewport
    const radius =
      typeof slide.cornerRadius === 'number' && slide.cornerRadius > 0
        ? slide.cornerRadius
        : SLIDE_CORNER_RADIUS
    out.push({
      guid: frameGuid,
      type: 'FRAME',
      name: slide.name ?? String(index + 1),
      phase: 'CREATED',
      parentIndex: { guid: pageGuid, position: '!' },
      size,
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      fillPaints: slide.fillPaints?.length ? structuredClone(slide.fillPaints) : whiteFill(),
      cornerRadius: radius,
      rectangleTopLeftCornerRadius: radius,
      rectangleTopRightCornerRadius: radius,
      rectangleBottomRightCornerRadius: radius,
      rectangleBottomLeftCornerRadius: radius,
      // convert maps clipsContent from frameMaskDisabled === false
      frameMaskDisabled: false,
      visible: true
    })
  })

  for (const nc of nodeChanges) {
    const key = nodeKey(nc)
    if (!key) continue
    if (nc.type === 'DOCUMENT') continue
    if (slideKeys.has(key)) continue
    if (nc.type === 'CANVAS') continue
    if (nc.type && SCAFFOLDING_TYPES.has(nc.type)) continue
    if (nc.type === 'SLIDE') continue

    const clone = structuredClone(nc)
    const parentKey = guidKey(clone.parentIndex?.guid)
    if (parentKey && slideToFrame.has(parentKey)) {
      const frameGuid = slideToFrame.get(parentKey)
      if (frameGuid && clone.parentIndex) {
        clone.parentIndex = {
          ...clone.parentIndex,
          guid: frameGuid
        }
      }
    }
    out.push(clone)
  }

  return out
}
