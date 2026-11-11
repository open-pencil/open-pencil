import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { parseFigBuffer } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'
import { imageSize } from '@open-pencil/scene-graph/images'
import type { Size } from '@open-pencil/scene-graph/primitives'

import { loadDocument } from '#cli/headless'

/** The size of the `thumbnail.png` a `.fig` carries. */
export function figThumbnailSize(fig: Uint8Array): Size {
  const png = parseFigBuffer(fig.slice().buffer).thumbnailPNG
  const size = png && imageSize(png)
  if (!size) throw new Error('The archive has no thumbnail.png')
  return size
}

/** A `.fig` of four pages, each with one frame holding a rectangle, and its pages' IDs. */
export async function writeFourPageFig() {
  const graph = new SceneGraph()
  const [first] = graph.getPages()
  first.name = 'Page 1'
  const pages = [first, ...['Page 2', 'Page 3', 'Page 4'].map((name) => graph.addPage(name))]
  for (const [index, page] of pages.entries()) {
    const frame = graph.createNode('FRAME', page.id, {
      name: `Frame ${index + 1}`,
      width: 100,
      height: 100
    })
    graph.createNode('RECTANGLE', frame.id, { name: 'Box', width: 10, height: 10 })
  }
  const path = join(await mkdtemp(join(tmpdir(), 'open-pencil-pages-')), 'pages.fig')
  await Bun.write(path, (await new IORegistry(BUILTIN_IO_FORMATS).writeDocument('fig', graph)).data)
  const loaded = await loadDocument(path)
  return { path, pageIds: loaded.getPages().map((page) => page.id) }
}
