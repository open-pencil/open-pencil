import { BLACK, SceneGraph } from '@open-pencil/scene-graph'
import type { Color, Fill } from '@open-pencil/scene-graph'

/** Default Figma Slides artboard size. */
export const EMPTY_SLIDE_WIDTH = 1920
export const EMPTY_SLIDE_HEIGHT = 1080
/**
 * Figma Slides artboard corner radius (presentation chrome).
 * Real .deck SLIDE nodes often omit cornerRadius; the rounded card is a slides UI trait.
 */
export const EMPTY_SLIDE_CORNER_RADIUS = 40

const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 }
const SUBTITLE_GRAY: Color = { r: 0.25, g: 0.25, b: 0.25, a: 1 }

export interface CreateEmptyDeckOptions {
  title?: string
  subtitle?: string
  slideName?: string
}

export interface AddEmptySlideOptions {
  /** Page / filmstrip label. Defaults to next index. */
  name?: string
  /** When true, seed title/subtitle (used for brand-new decks only). */
  withStarterText?: boolean
  title?: string
  subtitle?: string
}

function solidFill(color: Color): Fill[] {
  return [{ type: 'SOLID', color: { ...color }, opacity: 1, visible: true }]
}

function createSlideArtboard(
  graph: SceneGraph,
  pageId: string,
  slideName: string,
  options: { withStarterText?: boolean; title?: string; subtitle?: string } = {}
): string {
  const artboard = graph.createNode('FRAME', pageId, {
    name: slideName,
    x: 0,
    y: 0,
    width: EMPTY_SLIDE_WIDTH,
    height: EMPTY_SLIDE_HEIGHT,
    fills: solidFill(WHITE),
    cornerRadius: EMPTY_SLIDE_CORNER_RADIUS,
    topLeftRadius: EMPTY_SLIDE_CORNER_RADIUS,
    topRightRadius: EMPTY_SLIDE_CORNER_RADIUS,
    bottomRightRadius: EMPTY_SLIDE_CORNER_RADIUS,
    bottomLeftRadius: EMPTY_SLIDE_CORNER_RADIUS,
    clipsContent: true
  })

  if (options.withStarterText) {
    const title = options.title ?? 'Slide Deck Title'
    const subtitle = options.subtitle ?? 'This is just the beginning of something big.'
    const contentWidth = 1400
    const contentX = (EMPTY_SLIDE_WIDTH - contentWidth) / 2

    graph.createNode('TEXT', artboard.id, {
      name: 'Title',
      text: title,
      fontFamily: 'Inter',
      fontSize: 72,
      fontWeight: 700,
      textAlignHorizontal: 'CENTER',
      textAutoResize: 'HEIGHT',
      width: contentWidth,
      height: 90,
      x: contentX,
      y: 420,
      fills: solidFill(BLACK)
    })

    graph.createNode('TEXT', artboard.id, {
      name: 'Subtitle',
      text: subtitle,
      fontFamily: 'Inter',
      fontSize: 28,
      fontWeight: 400,
      textAlignHorizontal: 'CENTER',
      textAutoResize: 'HEIGHT',
      width: contentWidth,
      height: 40,
      x: contentX,
      y: 530,
      fills: solidFill(SUBTITLE_GRAY)
    })
  }

  return artboard.id
}

/**
 * Build a new Figma Slides–style document:
 * one page, one white 1920×1080 artboard, starter title + subtitle.
 * Viewport chrome (dark grey) is applied by the editor, not by the graph.
 */
export function createEmptyDeckGraph(options: CreateEmptyDeckOptions = {}): SceneGraph {
  const slideName = options.slideName ?? '1'
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('SceneGraph constructor did not create a page')

  graph.updateNode(page.id, { name: slideName })
  createSlideArtboard(graph, page.id, slideName, {
    withStarterText: true,
    title: options.title,
    subtitle: options.subtitle
  })

  return graph
}

/**
 * Append a blank white slide (page + 1920×1080 artboard) to an existing deck graph.
 * Returns the new page id. Does not switch the editor page — caller should `switchPage`.
 */
export function addEmptySlide(graph: SceneGraph, options: AddEmptySlideOptions = {}): string {
  const pages = graph.getPages()
  const slideName = options.name ?? String(pages.length + 1)
  const page = graph.addPage(slideName)
  createSlideArtboard(graph, page.id, slideName, {
    withStarterText: options.withStarterText ?? false,
    title: options.title,
    subtitle: options.subtitle
  })
  return page.id
}
