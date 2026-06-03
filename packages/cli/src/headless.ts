import { BUILTIN_IO_FORMATS, IORegistry, initCanvasKit } from '@inkly/core/io'
import { computeAllLayouts } from '@inkly/core/layout'
import type { SceneGraph } from '@inkly/core/scene-graph'

export { initCanvasKit }

const io = new IORegistry(BUILTIN_IO_FORMATS)

export async function loadDocument(filePath: string): Promise<SceneGraph> {
  const bytes = new Uint8Array(await Bun.file(filePath).arrayBuffer())
  const { graph } = await io.readDocument({ name: filePath, data: bytes })
  computeAllLayouts(graph)
  return graph
}
