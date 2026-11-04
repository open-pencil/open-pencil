import type { SceneGraph } from '@open-pencil/scene-graph'
import {
  DEFAULT_FIG_COMPRESSION,
  type FigCompression
} from '@open-pencil/scene-graph/fig-compression'
import { OPEN_PENCIL_PLUGIN_DATA, readPluginData } from '@open-pencil/scene-graph/plugin-data'

/**
 * The zstd level each preset writes at. Reading costs the same at every level; writing does
 * not: on a 45 MB document, level 9 takes about 5× and level 19 about 150× level 3's time.
 */
export const FIG_COMPRESSION_LEVELS = {
  fast: 3,
  smaller: 9,
  smallest: 19
} as const satisfies Record<FigCompression, number>

/** The compression the document asks its `.fig` to be written with. */
export function figCompressionOf(graph: SceneGraph): FigCompression {
  return (
    readPluginData(
      graph.getNode(graph.rootId)?.pluginData,
      OPEN_PENCIL_PLUGIN_DATA.figCompression
    ) ?? DEFAULT_FIG_COMPRESSION
  )
}

export function figCompressionLevel(graph: SceneGraph): number {
  return FIG_COMPRESSION_LEVELS[figCompressionOf(graph)]
}
