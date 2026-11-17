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
 * index are kept, so a page that repeats an icon pays for it once. Without its index or the
 * shortlisted icons, as offline, the matcher names nothing and says why.
 */
export function createIconMatcher(services: IconMatcherServices): IconMatcher {
  let index: Promise<IconIndex | null> | undefined
  const answers = new Map<string, string | null>()
  const drawn = new Map<string, Promise<Uint8Array | null>>()

  function loadIndex(): Promise<IconIndex | null> {
    index ??= services.index().catch((error: unknown) => {
      console.warn('Icons are not named: whaticon’s index did not load', error)
      return null
    })
    return index
  }

  const coverage = (svg: string, width: number, height: number) =>
    svgCoverage(services.draw, svg, width, height)

  async function shortlist(svg: string, icons: IconIndex): Promise<Shortlisted | null> {
    const grid = await coverage(svg, DEFAULT_SIZE + 1, DEFAULT_SIZE)
    if (!grid) return null
    // Icons with identical hashes are copies; the first stands for them all.
    const names = findMatchesByHash(dHashFromPixels(grid), icons, SHORTLIST).map((m) => m.name)
    if (names.length === 0) return null
    const drawing = await coverage(svg, COMPARED_SIZE, COMPARED_SIZE)
    return drawing ? { drawing, names } : null
  }

  function drawnIcon(name: string, svg: string): Promise<Uint8Array | null> {
    const known = drawn.get(name)
    if (known) return known
    const drawing = coverage(svg, COMPARED_SIZE, COMPARED_SIZE)
    drawn.set(name, drawing)
    return drawing
  }

  async function closest(
    { drawing, names }: Shortlisted,
    previews: ReadonlyMap<string, string>
  ): Promise<string | null> {
    let best: { name: string; similarity: number } | null = null
    for (const name of names) {
      const preview = previews.get(name)
      const candidate = preview ? await drawnIcon(name, preview) : null
      if (!candidate) continue
      const similarity = coverageSimilarity(drawing, candidate)
      if (!best || similarity > best.similarity) best = { name, similarity }
    }
    return best && best.similarity >= NAMED_AT ? best.name : null
  }

  async function previewsOf(names: readonly string[]): Promise<ReadonlyMap<string, string> | null> {
    if (names.length === 0) return new Map()
    try {
      return await services.icons.previews(names)
    } catch (error) {
      console.warn('Icons are not named: the icons to compare with did not load', error)
      return null
    }
  }

  return async (svgs) => {
    const unknown = uniq(svgs.filter((svg) => !answers.has(svg)))
    const icons = unknown.length > 0 ? await loadIndex() : null
    if (icons) {
      const shortlists = await Promise.all(unknown.map((svg) => shortlist(svg, icons)))
      const previews = await previewsOf(uniq(shortlists.flatMap((listed) => listed?.names ?? [])))
      // Not remembered, so a later import asks again once the icons can be fetched.
      if (!previews) return svgs.map((svg) => answers.get(svg) ?? null)
      const named = await Promise.all(
        shortlists.map((listed) => (listed ? closest(listed, previews) : Promise.resolve(null)))
      )
      unknown.forEach((svg, i) => answers.set(svg, named[i] ?? null))
    }
    return svgs.map((svg) => answers.get(svg) ?? null)
  }
}
