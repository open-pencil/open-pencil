import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import type { SceneGraph } from '@open-pencil/scene-graph'

const io = new IORegistry(BUILTIN_IO_FORMATS)

/** Renders the same PNG reference for generated stories and authored implementation mappings. */
export function createDesignImageRenderer(graph: SceneGraph) {
  return async (nodeId: string): Promise<Uint8Array> => {
    const result = await io.exportContent(
      'png',
      { graph, target: { scope: 'node', nodeId } },
      { format: 'PNG', scale: 2 }
    )
    if (!(result.data instanceof Uint8Array)) throw new Error('PNG export returned text.')
    return result.data
  }
}
