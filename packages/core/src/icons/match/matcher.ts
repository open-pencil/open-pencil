import { uniq } from 'es-toolkit'
import { DEFAULT_SIZE, dHashFromPixels, findMatchesByHash, type IconIndex } from 'whaticon/hash'

import { SceneGraph } from '@open-pencil/scene-graph'

import type { IconProvider } from '#core/icons/provider'
import type { RGBAImage } from '#core/io/formats/raster/pixels'
import { createSVGNodes } from '#core/io/formats/svg/import'

import { coverageGrid, coverageSimilarity } from './coverage'

/**
 * The icons whose hashes come closest, compared by drawing them. A hash finds the right icon among
 * its first ten for nearly every icon a page draws, but its similarity cannot tell an icon from a
 * shape that merely resembles one, so it only shortlists.
 */
const SHORTLIST = { limit: 10, threshold: 0.6 }

/** The side of the square an SVG and its candidates are drawn in to be compared. */
const COMPARED_SIZE = 64

/**
 * How alike an SVG and an icon must draw to name it. Measured on 600 icons from six sets as pages
 * carry them, 300 random shapes, and 200 icons with one part swapped for a square: at 0.9, 507
 * icons are named, 495 by their own name and the rest by a lookalike's, such as a set's solid
 * arrow for its outline one; no shape is; and the 4 changed icons named are duotone icons whose
 * tinted part was swapped, named as their outline.
 */
const NAMED_AT = 0.9

/** What naming icons by how they look draws and fetches with. */
export interface IconMatcherServices {
  /** whaticon's index of icons to name, loaded on first use, such as `fetchIconIndex`. */
  index: () => Promise<IconIndex>
  /** Where the shortlisted icons' SVG comes from. */
  icons: IconProvider
  /** Draws a layer at a scale, as `headlessRenderNodes` and the editor's renderer do. */
  draw: (
    graph: SceneGraph,
    pageId: string,
    nodeId: string,
    scale: number
  ) => Promise<RGBAImage | null>
}

/**
 * An SVG drawn as OpenPencil draws it, fitted and centered in `width` by `height`, as coverage:
 * what the matcher hashes and compares.
 */
export async function svgCoverage(
  draw: IconMatcherServices['draw'],
  svg: string,
  width: number,
  height: number
): Promise<Uint8Array | null> {
  const graph = new SceneGraph()
  // A new graph starts with one page.
  const [page] = graph.getPages()
  const node = createSVGNodes(graph, page.id, svg, { defaultColor: '#000000' })
  if (!node || node.width <= 0 || node.height <= 0) return null
  // SVG import gives its frame a white fill, which would cover the whole box.
  graph.updateNode(node.id, { fills: [] })
  const image = await draw(
    graph,
    page.id,
    node.id,
    Math.min(width / node.width, height / node.height)
  )
  return image ? coverageGrid(image, width, height) : null
}

/**
 * The Iconify icon each SVG draws, as `prefix:name`, or null where it draws none closely enough.
 * A page's SVGs are matched together, so the icons they are compared with are fetched at once.
 */
export type IconMatcher = (svgs: readonly string[]) => Promise<(string | null)[]>

/** An SVG drawn to be compared, and the icons its hash shortlists. */
interface Shortlisted {
  drawing: Uint8Array
  names: string[]
}

/**
 * Names the icons SVG draws: whaticon's hash of the SVG drawn as OpenPencil draws it shortlists
 * icons, and the one that draws most alike, if alike enough, names it. Answers, drawings, and the
 * index are kept, so a page that repeats an icon pays for it once. What could not be loaded or
 * drawn, as offline, leaves its SVG unnamed and is tried again by the next call; the matcher says
 * why once.
 */
export function createIconMatcher(services: IconMatcherServices): IconMatcher {
  let index: Promise<IconIndex> | undefined
  let warned = false
  const answers = new Map<string, string | null>()
  const drawn = new Map<string, Promise<Uint8Array | null | undefined>>()

  function warn(reason: string, error: unknown): void {
    if (warned) return
    warned = true
    console.warn(`Icons are not named: ${reason}`, error)
  }

  async function loadIndex(): Promise<IconIndex | null> {
    index ??= services.index()
    try {
      return await index
    } catch (error) {
      index = undefined
      warn('whaticon’s index did not load', error)
      return null
    }
  }

  /** An SVG as coverage: null when it draws nothing, undefined when drawing it failed. */
  async function coverage(
    svg: string,
    width: number,
    height: number
  ): Promise<Uint8Array | null | undefined> {
    try {
      return await svgCoverage(services.draw, svg, width, height)
    } catch (error) {
      warn('an SVG could not be drawn to compare', error)
      return undefined
    }
  }

  /** The SVG's shortlist: null when no icon comes close, undefined when it could not be drawn. */
  async function shortlist(svg: string, icons: IconIndex): Promise<Shortlisted | null | undefined> {
    const grid = await coverage(svg, DEFAULT_SIZE + 1, DEFAULT_SIZE)
    if (!grid) return grid
    // Icons with identical hashes are copies; the first stands for them all.
    const names = findMatchesByHash(dHashFromPixels(grid), icons, SHORTLIST).map((m) => m.name)
    if (names.length === 0) return null
    const drawing = await coverage(svg, COMPARED_SIZE, COMPARED_SIZE)
    return drawing && { drawing, names }
  }

  function drawnIcon(name: string, svg: string): Promise<Uint8Array | null | undefined> {
    const known = drawn.get(name)
    if (known) return known
    // A drawing that failed is forgotten, so the next call draws it again.
    const drawing = coverage(svg, COMPARED_SIZE, COMPARED_SIZE).then((result) => {
      if (result === undefined) drawn.delete(name)
      return result
    })
    drawn.set(name, drawing)
    return drawing
  }

  /**
   * The shortlisted icon that draws most like the SVG, if alike enough, and whether every one
   * was compared: an answer from fewer is not kept unless it names an icon.
   */
  async function closest(
    { drawing, names }: Shortlisted,
    previews: ReadonlyMap<string, string>
  ): Promise<{ name: string | null; complete: boolean }> {
    let best: { name: string; similarity: number } | null = null
    let complete = true
    for (const name of names) {
      const preview = previews.get(name)
      const candidate = preview ? await drawnIcon(name, preview) : undefined
      if (candidate === undefined) complete = false
      if (!candidate) continue
      const similarity = coverageSimilarity(drawing, candidate)
      if (!best || similarity > best.similarity) best = { name, similarity }
    }
    return { name: best && best.similarity >= NAMED_AT ? best.name : null, complete }
  }

  async function previewsOf(names: readonly string[]): Promise<ReadonlyMap<string, string> | null> {
    if (names.length === 0) return new Map()
    try {
      return await services.icons.previews(names)
    } catch (error) {
      warn('the icons to compare with did not load', error)
      return null
    }
  }

  async function answer(
    listed: Shortlisted | null | undefined,
    previews: ReadonlyMap<string, string>
  ): Promise<{ name: string | null; complete: boolean }> {
    if (listed === undefined) return { name: null, complete: false }
    return listed ? closest(listed, previews) : { name: null, complete: true }
  }

  return async (svgs) => {
    const unknown = uniq(svgs.filter((svg) => !answers.has(svg)))
    const icons = unknown.length > 0 ? await loadIndex() : null
    if (icons) {
      const shortlists = await Promise.all(unknown.map((svg) => shortlist(svg, icons)))
      const previews = await previewsOf(uniq(shortlists.flatMap((listed) => listed?.names ?? [])))
      if (previews) {
        const results = await Promise.all(shortlists.map((listed) => answer(listed, previews)))
        unknown.forEach((svg, i) => {
          const { name, complete } = results[i]
          if (name || complete) answers.set(svg, name)
        })
      }
    }
    return svgs.map((svg) => answers.get(svg) ?? null)
  }
}
