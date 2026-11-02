import {
  DEFAULT_FIG_COMPRESSION,
  type FigCompression
} from '@lawha/scene-graph/fig-compression'
import { LAWHA_PLUGIN_DATA, withPluginData } from '@lawha/scene-graph/plugin-data'

import { figCompressionOf } from '#core/io/formats/fig/compression'

import type { EditorContext } from './types'

/** How tightly the document's `.fig` is compressed, and the command that changes it. */
export function createFigCompressionActions(ctx: EditorContext) {
  function figCompression(): FigCompression {
    return figCompressionOf(ctx.graph)
  }

  /** Sets the document's compression as one undo step; the default leaves no entry behind. */
  function setFigCompression(next: FigCompression): void {
    const previous = figCompression()
    if (previous === next) return
    const write = (value: FigCompression) => {
      const rootId = ctx.graph.rootId
      const root = ctx.graph.getNode(rootId)
      if (!root) return
      ctx.graph.updateNode(rootId, {
        pluginData: withPluginData(
          root.pluginData,
          LAWHA_PLUGIN_DATA.figCompression,
          value === DEFAULT_FIG_COMPRESSION ? undefined : value
        )
      })
    }
    write(next)
    ctx.undo.push({
      label: 'Change compression',
      forward: () => write(next),
      inverse: () => write(previous)
    })
  }

  return { figCompression, setFigCompression }
}
