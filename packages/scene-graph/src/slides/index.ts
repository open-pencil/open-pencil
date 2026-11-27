import type { SceneGraph } from '../graph'
import type { SceneNode } from '../types'
import type { SlideSettings } from './types'

export * from './drop'
export * from './types'

/** Figma's slide: 1920 by 1080, with 240 between slides and 600 between the rows of a grid. */
export const DEFAULT_SLIDE_SIZE = { width: 1920, height: 1080 } as const

/** The sizes a deck offers its slides, by shape; any other size is a custom one. */
export const SLIDE_SIZE_PRESETS = [
  { id: 'wide', width: 1920, height: 1080 },
  { id: 'standard', width: 1440, height: 1080 },
  { id: 'square', width: 1080, height: 1080 },
  { id: 'portrait', width: 1080, height: 1920 }
] as const
export type SlideSizePreset = (typeof SLIDE_SIZE_PRESETS)[number]
const SLIDE_GAP = 240
const ROW_GAP = 600
const SLIDES_PER_LINE = 20

const WHITE = { r: 1, g: 1, b: 1, a: 1 } as const

export function defaultSlideSettings(): SlideSettings {
  return { skipped: false, notes: '', transition: null }
}

/** What a slide keeps, whether or not it was ever set; null for any other layer. */
export function slideSettings(node: Pick<SceneNode, 'type' | 'slide'>): SlideSettings | null {
  return node.type === 'SLIDE' ? (node.slide ?? defaultSlideSettings()) : null
}

/** The grid that holds a deck's slides on a page, if the page has one. */
export function slideGrid(graph: SceneGraph, pageId: string): SceneNode | undefined {
  return graph.getChildren(pageId).find((node) => node.type === 'SLIDE_GRID')
}

/** A page's slides by row, in the order a deck presents them. */
export function slideRows(graph: SceneGraph, pageId: string): SceneNode[][] {
  const grid = slideGrid(graph, pageId)
  if (!grid) return []
  return graph
    .getChildren(grid.id)
    .filter((row) => row.type === 'SLIDE_ROW')
    .map((row) => graph.getChildren(row.id).filter((node) => node.type === 'SLIDE'))
}

/** The slide the deck moves on to from `slide`, passing by skipped slides, or undefined at the end. */
export function nextSlide(graph: SceneGraph, slide: SceneNode): SceneNode | undefined {
  const page = slide.parentId
    ? graph.closest(slide.parentId, (node) => node.type === 'CANVAS')
    : undefined
  if (!page) return undefined
  const slides = slideRows(graph, page.id).flat()
  const index = slides.findIndex((node) => node.id === slide.id)
  if (index === -1) return undefined
  return slides.slice(index + 1).find((node) => !slideSettings(node)?.skipped)
}

/**
 * Each slide's number, by ID, in the order a deck presents them: skipped slides have none and are
 * not counted, as in Figma.
 */
export function slideNumbers(graph: SceneGraph, pageId: string): Map<string, number | null> {
  let shown = 0
  return new Map(
    slideRows(graph, pageId)
      .flat()
      .map((slide) => [slide.id, slideSettings(slide)?.skipped ? null : ++shown])
  )
}

/** Adds the grid a deck's slides sit in to a page. */
export function createSlideGrid(graph: SceneGraph, pageId: string): SceneNode {
  return graph.createNode('SLIDE_GRID', pageId, {
    name: 'Presentation',
    layoutMode: 'VERTICAL',
    itemSpacing: ROW_GAP,
    // Figma pads a grid before its slides only.
    paddingTop: SLIDE_GAP,
    paddingLeft: SLIDE_GAP,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG'
  })
}

/** Adds a row, which Figma calls a section, to the end of a grid. */
export function createSlideRow(graph: SceneGraph, gridId: string): SceneNode {
  return graph.createNode('SLIDE_ROW', gridId, {
    name: 'Section',
    layoutMode: 'HORIZONTAL',
    layoutWrap: 'WRAP',
    layoutAlignSelf: 'STRETCH',
    itemSpacing: SLIDE_GAP,
    counterAxisSpacing: SLIDE_GAP,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    maxWidth: SLIDES_PER_LINE * (DEFAULT_SLIDE_SIZE.width + SLIDE_GAP) + SLIDE_GAP
  })
}

/** Adds an empty slide to the end of a row, at the size of the slide before it. */
export function createSlide(graph: SceneGraph, rowId: string): SceneNode {
  const before = graph.getChildren(rowId).findLast((node) => node.type === 'SLIDE')
  const { width, height } = before ?? DEFAULT_SLIDE_SIZE
  return graph.createNode('SLIDE', rowId, {
    name: 'Slide',
    width,
    height,
    clipsContent: true,
    fills: [{ type: 'SOLID', color: { ...WHITE }, opacity: 1, visible: true }],
    slide: defaultSlideSettings()
  })
}
