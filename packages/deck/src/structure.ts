import type { GUID, NodeChange, Vector } from '@open-pencil/kiwi/fig/codec'

import { comparePosition, guidKey, nextLocalId, nodeKey } from './guid'

const DEFAULT_SLIDE_SIZE: Vector = { x: 1920, y: 1080 }
const SLIDE_PADDING = 240

function fractionalPosition(index: number): string {
  if (index < 90) return String.fromCharCode(0x21 + index)
  return `!${index.toString(36)}`
}

function makeGuid(sessionID: number, localID: number): GUID {
  return { sessionID, localID }
}

function findDocument(nodeChanges: NodeChange[]): NodeChange {
  const document =
    nodeChanges.find((n) => n.type === 'DOCUMENT') ??
    nodeChanges.find((n) => nodeKey(n) === '0:0')
  if (!document?.guid) {
    throw new Error('Deck structure failed: missing DOCUMENT node')
  }
  return document
}

function userPages(nodeChanges: NodeChange[]): NodeChange[] {
  return nodeChanges
    .filter(
      (n) =>
        n.type === 'CANVAS' &&
        n.phase !== 'REMOVED' &&
        !n.internalOnly &&
        !/internal\s*only/i.test(n.name ?? '')
    )
    .sort((a, b) => comparePosition(a.parentIndex?.position, b.parentIndex?.position))
}

/** Root artboard FRAME under a page (the single 1920×1080 slide rectangle). */
function pageArtboard(nodeChanges: NodeChange[], page: NodeChange): NodeChange | undefined {
  const pageKey = nodeKey(page)
  if (!pageKey) return undefined
  const frames = nodeChanges
    .filter(
      (n) =>
        n.type === 'FRAME' &&
        n.phase !== 'REMOVED' &&
        guidKey(n.parentIndex?.guid) === pageKey
    )
    .sort((a, b) => comparePosition(a.parentIndex?.position, b.parentIndex?.position))
  return frames[0]
}

function collectInternalCanvases(nodeChanges: NodeChange[], pageKeys: Set<string>): NodeChange[] {
  const out: NodeChange[] = []
  for (const nc of nodeChanges) {
    if (nc.type !== 'CANVAS') continue
    if (pageKeys.has(nodeKey(nc) ?? '')) continue
    if (!(nc.internalOnly || /internal\s*only/i.test(nc.name ?? ''))) continue
    const clone = structuredClone(nc)
    clone.internalOnly = true
    out.push(clone)
  }
  return out
}

function buildScaffold(
  docGuid: GUID,
  userCanvasGuid: GUID,
  gridGuid: GUID,
  rowGuid: GUID,
  slideSize: Vector
): NodeChange[] {
  return [
    {
      guid: userCanvasGuid,
      type: 'CANVAS',
      name: 'Page 1',
      phase: 'CREATED',
      parentIndex: { guid: docGuid, position: '!' },
      visible: true,
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    },
    {
      guid: gridGuid,
      type: 'SLIDE_GRID',
      name: 'Presentation',
      phase: 'CREATED',
      parentIndex: { guid: userCanvasGuid, position: '!' },
      size: {
        x: slideSize.x + SLIDE_PADDING * 2,
        y: slideSize.y + SLIDE_PADDING * 2
      },
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      visible: true
    },
    {
      guid: rowGuid,
      type: 'SLIDE_ROW',
      name: 'Row',
      phase: 'CREATED',
      parentIndex: { guid: gridGuid, position: '!' },
      size: { ...slideSize },
      transform: {
        m00: 1,
        m01: 0,
        m02: SLIDE_PADDING,
        m10: 0,
        m11: 1,
        m12: SLIDE_PADDING
      },
      stackMode: 'HORIZONTAL',
      stackSpacing: SLIDE_PADDING,
      visible: true
    }
  ]
}

/**
 * Invert design-shaped multi-page NodeChanges into Figma Slides scaffolding.
 *
 * Expects open layout: CANVAS page → one white FRAME artboard (slide) → content.
 * Unwraps the artboard so SLIDE holds the content directly.
 */
export function structurePagesToDeck(nodeChanges: NodeChange[]): NodeChange[] {
  const document = findDocument(nodeChanges)
  const docGuid = document.guid as GUID
  const pages = userPages(nodeChanges)
  if (pages.length === 0) {
    throw new Error('Deck structure failed: no user pages to convert into slides')
  }

  const pageKeys = new Set(
    pages.map((p) => nodeKey(p)).filter((k): k is string => k !== null)
  )

  let localId = nextLocalId(nodeChanges)
  const alloc = (): GUID => makeGuid(0, localId++)
  const userCanvasGuid = alloc()
  const gridGuid = alloc()
  const rowGuid = alloc()

  const firstArtboard = pageArtboard(nodeChanges, pages[0])
  const slideSize: Vector =
    firstArtboard?.size?.x && firstArtboard.size?.y
      ? { x: firstArtboard.size.x, y: firstArtboard.size.y }
      : { ...DEFAULT_SLIDE_SIZE }

  /** page key → slide guid; artboard key → slide guid (for reparent). */
  const reparentToSlide = new Map<string, GUID>()
  const artboardKeys = new Set<string>()

  const out: NodeChange[] = [structuredClone(document)]
  out.push(...collectInternalCanvases(nodeChanges, pageKeys))
  out.push(...buildScaffold(docGuid, userCanvasGuid, gridGuid, rowGuid, slideSize))

  pages.forEach((page, index) => {
    const pageKey = nodeKey(page)
    const artboard = pageArtboard(nodeChanges, page)
    const artboardKey = artboard ? nodeKey(artboard) : null
    const slideGuid = page.guid ?? alloc()
    if (pageKey) reparentToSlide.set(pageKey, slideGuid)
    if (artboardKey) {
      artboardKeys.add(artboardKey)
      reparentToSlide.set(artboardKey, slideGuid)
    }

    const size =
      artboard?.size?.x && artboard.size?.y
        ? { x: artboard.size.x, y: artboard.size.y }
        : { ...slideSize }

    out.push({
      guid: slideGuid,
      type: 'SLIDE',
      name: page.name ?? artboard?.name ?? String(index + 1),
      phase: 'CREATED',
      parentIndex: { guid: rowGuid, position: fractionalPosition(index) },
      size,
      transform: {
        m00: 1,
        m01: 0,
        m02: index * (size.x + SLIDE_PADDING),
        m10: 0,
        m11: 1,
        m12: 0
      },
      fillPaints: artboard?.fillPaints ?? [
        {
          type: 'SOLID',
          color: { r: 1, g: 1, b: 1, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      visible: true
    })
  })

  for (const nc of nodeChanges) {
    if (nc.type === 'DOCUMENT' || nc.type === 'CANVAS') continue
    const key = nodeKey(nc)
    if (key && artboardKeys.has(key)) continue // unwrap artboard FRAME

    const clone = structuredClone(nc)
    const parentKey = guidKey(clone.parentIndex?.guid)
    if (parentKey && reparentToSlide.has(parentKey) && clone.parentIndex) {
      clone.parentIndex = {
        ...clone.parentIndex,
        guid: reparentToSlide.get(parentKey) as GUID
      }
    }
    out.push(clone)
  }

  return out
}
