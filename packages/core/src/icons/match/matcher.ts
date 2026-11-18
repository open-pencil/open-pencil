import { createMatcher, fetchIndex, type Matcher } from 'whaticon/match'

import { SceneGraph } from '@open-pencil/scene-graph'
import { DEADLINE_MS } from '@open-pencil/std/timing'

import { parseIconName, type IconProvider } from '#core/icons/provider'
import type { RGBAImage } from '#core/io/formats/raster/pixels'
import { createSVGNodes } from '#core/io/formats/svg/import'

/**
 * The Iconify icon each SVG draws, as `prefix:name`, or null where it draws none closely enough.
 * A page's SVGs are matched together, so the icons they are compared with are fetched at once.
 */
export type IconMatcher = Matcher

/** What naming icons by how they draw uses: whaticon's index, icons, and a renderer. */
export interface IconMatcherServices {
  /** whaticon's index of icons to name, loaded on first use, such as `fetchIconIndex`. */
  index: () => ReturnType<typeof fetchIndex>
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
 * How long the index may take to download, body included, before naming icons gives up and the
 * import keeps its SVG as artwork; the next import tries again.
 */
const INDEX_TIMEOUT_MS = DEADLINE_MS.transfer

/**
 * whaticon's index of the popular Iconify sets, from the version Core depends on. Its downloads
 * share one signal, which `timeoutMs` aborts, as a failed download does the other's, so none
 * outlives the attempt; the deadline also rejects the attempt itself.
 */
export async function fetchIconIndex(
  fetcher: typeof globalThis.fetch,
  timeoutMs = INDEX_TIMEOUT_MS
): ReturnType<typeof fetchIndex> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new Error(`whaticon's index took longer than ${timeoutMs} ms`))
  }, timeoutMs)
  // A proxy keeps the fetcher's own type while giving each request the shared signal.
  const abortable = new Proxy(fetcher, {
    apply: (target, self, [input, init]: Parameters<typeof globalThis.fetch>) =>
      target.call(self, input, { ...init, signal: controller.signal })
  })
  // The deadline also rejects the attempt itself, should a fetcher not stop at the signal.
  const expired = new Promise<never>((_, reject) => {
    const stopped = () =>
      reject(new Error("whaticon's index download stopped", { cause: controller.signal.reason }))
    controller.signal.addEventListener('abort', stopped, { once: true })
  })
  try {
    return await Promise.race([fetchIndex(abortable), expired])
  } catch (error) {
    controller.abort(error)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/**
 * An SVG drawn as OpenPencil draws it, at the largest size that fits `width` by `height`, on
 * transparency: what whaticon hashes and compares. Null when the SVG has no size to draw; throws
 * when the renderer draws no image of it, which the matcher tries again later.
 */
export async function drawSVG(
  draw: IconMatcherServices['draw'],
  svg: string,
  width: number,
  height: number
): Promise<RGBAImage | null> {
  const graph = new SceneGraph()
  // A new graph starts with one page.
  const [page] = graph.getPages()
  const node = createSVGNodes(graph, page.id, svg, { defaultColor: '#000000' })
  if (!node || node.width <= 0 || node.height <= 0) return null
  // SVG import gives its frame a white fill, which would cover the whole box.
  graph.updateNode(node.id, { fills: [] })
  const scale = Math.min(width / node.width, height / node.height)
  const image = await draw(graph, page.id, node.id, scale)
  // A sized frame always has something to draw, so no image means drawing it failed.
  if (!image) throw new Error('The renderer drew no image of the SVG')
  return image
}

/**
 * The icons' SVG from `provider`, asked for a set at a time, so a provider that fails a whole call
 * leaves out only that set's icons, which the matcher compares with next time; throws only when
 * every set fails.
 */
async function previewsBySet(
  provider: IconProvider,
  names: readonly string[]
): Promise<Map<string, string>> {
  // A Map, as createIconSetsProvider groups by provider, so no prefix is read as an object key.
  const bySet = new Map<string, string[]>()
  for (const name of names) {
    const prefix = parseIconName(name)?.prefix ?? ''
    bySet.set(prefix, [...(bySet.get(prefix) ?? []), name])
  }
  const sets = [...bySet.values()]
  // Each set is asked inside an async call, so a provider that throws at once fails that set only.
  const settled = await Promise.allSettled(sets.map(async (set) => provider.previews(set)))
  const failed = settled.find((result) => result.status === 'rejected')
  if (failed && settled.every((result) => result.status === 'rejected')) throw failed.reason
  return new Map(
    settled.flatMap((result) => (result.status === 'fulfilled' ? [...result.value] : []))
  )
}

/**
 * Names the icons SVG draws with whaticon's matcher, drawing each SVG and candidate icon as
 * OpenPencil draws it and taking candidates from `icons`. What could not be loaded or drawn, as
 * offline, leaves its SVG unnamed, is tried again by the next call, and is warned about once.
 */
export function createIconMatcher(services: IconMatcherServices): IconMatcher {
  return createMatcher({
    index: services.index,
    draw: (svg, width, height) => drawSVG(services.draw, svg, width, height),
    icons: (names) => previewsBySet(services.icons, names),
    onError: (reason, error) => console.warn(`Icons are not named: ${reason}`, error)
  })
}
