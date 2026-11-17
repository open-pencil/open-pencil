import { getCanvasKit } from '#core/canvaskit'
import { defaultIcons, type IconProvider } from '#core/icons'
import { headlessRenderNodes } from '#core/io/formats/raster/headless'
import { createCanvasKitRasterCodec } from '#core/io/formats/raster/pixels'

import { fetchIconIndex } from './whaticon'
import { createIconMatcher, type IconMatcher } from './matcher'

/**
 * Names icons with the headless renderer, as the CLI and the MCP server draw: CanvasKit loads when
 * the first SVG is compared, and the index when the first one is hashed.
 */
export function createHeadlessIconMatcher(
  fetcher: typeof globalThis.fetch = globalThis.fetch,
  icons: IconProvider = defaultIcons
): IconMatcher {
  return createIconMatcher({
    index: () => fetchIconIndex(fetcher),
    icons,
    async draw(graph, pageId, nodeId, scale) {
      const png = await headlessRenderNodes(graph, pageId, [nodeId], { scale })
      return png && createCanvasKitRasterCodec(await getCanvasKit()).decode(png)
    }
  })
}
