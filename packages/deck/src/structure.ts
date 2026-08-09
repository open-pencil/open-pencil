import type { GUID, NodeChange, Vector } from '@open-pencil/kiwi/fig/codec'

import { comparePosition, guidKey, nextLocalIdFromGuids, nodeKey } from './guid'
import { pickCarriedSlideFields, withoutCarriedSlideFields } from './slide-fields'

const DEFAULT_SLIDE_SIZE: Vector = { x: 1920, y: 1080 }
const SLIDE_PADDING = 240
/** Content insets Figma writes on a slide. */
const SLIDE_STACK_PADDING_X = 168
const SLIDE_STACK_PADDING_Y = 128

function fractionalPosition(index: number): string {
  if (index < 90) return String.fromCharCode(0x21 + index)
  return `!${index.toString(36)}`
}

function makeGuid(sessionID: number, localID: number): GUID {
  return { sessionID, localID }
}

function findDocument(nodeChanges: NodeChange[]): NodeChange {
  const document =
    nodeChanges.find((n) => n.type === 'DOCUMENT') ?? nodeChanges.find((n) => nodeKey(n) === '0:0')
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
      (n) => n.type === 'FRAME' && n.phase !== 'REMOVED' && guidKey(n.parentIndex?.guid) === pageKey
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
      opacity: 1,
      backgroundEnabled: true,
      backgroundOpacity: 1,
      strokeWeight: 0,
      strokeAlign: 'CENTER',
      strokeJoin: 'BEVEL',
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
/**
 * Figma Slides theme bindings carried over from the source deck. They reference the
 * variable set and text styles on the internal-only canvas; without them Figma shows no
 * template style and renders the slides unthemed.
 */
export type DeckThemeBindings = Record<string, unknown>

/**
 * How each page collapses back into a single SLIDE.
 *
 * A page CANVAS plus its artboard FRAME are the two halves of one slide, and the
 * artboard is the half that kept the slide's guid on import, so it hands that identity
 * back here. The page's own guid is minted fresh every time a deck is opened and is
 * never written to the archive.
 */
interface SlideIdentities {
  /** page key → its artboard FRAME (unwrapped: the SLIDE takes its place). */
  artboardByPage: Map<string, NodeChange>
  /** page key → the guid its SLIDE is written with. */
  slideGuidByPage: Map<string, GUID>
  artboardKeys: Set<string>
}

function resolveSlideIdentities(nodeChanges: NodeChange[], pages: NodeChange[]): SlideIdentities {
  const artboardByPage = new Map<string, NodeChange>()
  const slideGuidByPage = new Map<string, GUID>()
  const artboardKeys = new Set<string>()

  for (const page of pages) {
    const key = nodeKey(page)
    if (key === null) continue
    const artboard = pageArtboard(nodeChanges, page)
    if (artboard) {
      artboardByPage.set(key, artboard)
      const artboardKey = nodeKey(artboard)
      if (artboardKey !== null) artboardKeys.add(artboardKey)
    }
    const slideGuid = artboard?.guid ?? page.guid
    if (slideGuid) slideGuidByPage.set(key, slideGuid)
  }

  return { artboardByPage, slideGuidByPage, artboardKeys }
}

/**
 * First free localID, counting only the guids that reach the archive.
 *
 * Page CANVAS guids are excluded because they are synthesized on every import and
 * discarded on every export. Letting them push the counter is what renumbered the
 * scaffolding — and through it every slide — each time a deck was opened and saved,
 * so an untouched document produced different bytes and re-uploaded on close.
 */
function scaffoldLocalIdBase(
  nodeChanges: NodeChange[],
  pageKeys: Set<string>,
  { slideGuidByPage, artboardKeys }: SlideIdentities
): number {
  const surviving: (GUID | undefined)[] = [...slideGuidByPage.values()]
  for (const nc of nodeChanges) {
    const key = nodeKey(nc)
    if (key !== null && (pageKeys.has(key) || artboardKeys.has(key))) continue
    surviving.push(nc.guid)
  }
  return nextLocalIdFromGuids(surviving)
}

export function structurePagesToDeck(
  nodeChanges: NodeChange[],
  theme?: DeckThemeBindings | null
): NodeChange[] {
  const document = findDocument(nodeChanges)
  const docGuid = document.guid as GUID
  const pages = userPages(nodeChanges)
  if (pages.length === 0) {
    throw new Error('Deck structure failed: no user pages to convert into slides')
  }

  const pageKeys = new Set(pages.map((p) => nodeKey(p)).filter((k): k is string => k !== null))

  const identities = resolveSlideIdentities(nodeChanges, pages)
  const { artboardByPage, slideGuidByPage, artboardKeys } = identities

  let localId = scaffoldLocalIdBase(nodeChanges, pageKeys, identities)
  const alloc = (): GUID => makeGuid(0, localId++)
  const userCanvasGuid = alloc()
  const gridGuid = alloc()
  const rowGuid = alloc()

  const firstPageKey = nodeKey(pages[0])
  const firstArtboard = firstPageKey === null ? undefined : artboardByPage.get(firstPageKey)
  const firstSize = firstArtboard?.size
  const slideSize: Vector =
    firstSize != null && firstSize.x > 0 && firstSize.y > 0
      ? { x: firstSize.x, y: firstSize.y }
      : { ...DEFAULT_SLIDE_SIZE }

  /** page key → slide guid; artboard key → slide guid (for reparent). */
  const reparentToSlide = new Map<string, GUID>()

  // The scene graph does not model theme bindings, so restore them onto the DOCUMENT.
  const out: NodeChange[] = [{ ...structuredClone(document), ...theme }]
  out.push(...collectInternalCanvases(nodeChanges, pageKeys).map(withoutCarriedSlideFields))
  out.push(...buildScaffold(docGuid, userCanvasGuid, gridGuid, rowGuid, slideSize))

  pages.forEach((page, index) => {
    const pageKey = nodeKey(page)
    const artboard = pageKey === null ? undefined : artboardByPage.get(pageKey)
    const artboardKey = artboard ? nodeKey(artboard) : null
    const slideGuid = (pageKey === null ? undefined : slideGuidByPage.get(pageKey)) ?? alloc()
    if (pageKey) reparentToSlide.set(pageKey, slideGuid)
    if (artboardKey) reparentToSlide.set(artboardKey, slideGuid)

    const artboardSize = artboard?.size
    const size =
      artboardSize != null && artboardSize.x > 0 && artboardSize.y > 0
        ? { x: artboardSize.x, y: artboardSize.y }
        : { ...slideSize }

    // Built as a plain object then asserted: Kiwi NodeChange optionals and carried
    // slide fields do not form an exact object-literal match for the generated type.
    out.push({
      // Each slide points at the document theme, as Figma writes it.
      ...(theme?.themeID ? { themeID: theme.themeID } : {}),
      ...(theme?.sourceLibraryKey ? { sourceLibraryKey: theme.sourceLibraryKey } : {}),
      // Speaker notes and transitions the page carried over from the source deck.
      ...pickCarriedSlideFields(page),
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
      visible: true,
      // Kiwi has no notion of "absent means default": an omitted optional field is simply
      // unset, and a reader that defaults opacity to 0 renders every child of the slide
      // invisible. Figma writes these on every slide, so we do too.
      opacity: 1,
      strokeWeight: 1,
      strokeAlign: 'INSIDE',
      strokeJoin: 'MITER',
      frameMaskDisabled: false,
      stackHorizontalPadding: SLIDE_STACK_PADDING_X,
      stackVerticalPadding: SLIDE_STACK_PADDING_Y,
      stackPaddingRight: SLIDE_STACK_PADDING_X,
      stackPaddingBottom: SLIDE_STACK_PADDING_Y
    } as NodeChange)
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
