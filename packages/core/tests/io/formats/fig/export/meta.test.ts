import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { omit } from 'es-toolkit'
import { unzipSync } from 'fflate'
import * as v from 'valibot'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer, readFigArchiveMeta } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'
import { imageSize } from '@open-pencil/scene-graph/images'

setDefaultTimeout(60_000)

// The float32 values the canvas record stores for rgb(0.2, 0.4, 0.6).
const BLUE_GRAY = { r: 0.20000000298023224, g: 0.4000000059604645, b: 0.6000000238418579, a: 1 }

function landingPage() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  graph.createNode('RECTANGLE', page.id, { name: 'Card', x: 49, y: 3, width: 345, height: 308 })
  new FigmaAPI(graph).currentPage.backgrounds = [
    { type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.6 }, opacity: 1, visible: true }
  ]
  return { graph, pageId: page.id }
}

function readArchive(bytes: Uint8Array) {
  const parsed = parseFigBuffer(bytes.slice().buffer)
  const raw = expectDefined(parsed.metaJSON, 'meta.json')
  const meta = readFigArchiveMeta(raw)
  if (!meta.success) throw new Error(`meta.json: ${v.summarize(meta.issues)}`)
  const png = expectDefined(parsed.thumbnailPNG, 'thumbnail.png')
  return {
    raw,
    meta: meta.output,
    thumbnailSize: expectDefined(imageSize(png), 'thumbnail size')
  }
}

describe('.fig meta.json', () => {
  test('records the document name, page background, and the thumbnail it rendered', async () => {
    const { graph, pageId } = landingPage()
    const { meta, thumbnailSize } = readArchive(
      await exportFigFile(graph, { pageId, renderHeadlessThumbnail: true, documentName: 'Landing' })
    )

    expect(meta.file_name).toBe('Landing')
    expect(meta.developer_related_links).toEqual([])
    expect(meta.client_meta.background_color).toEqual(BLUE_GRAY)
    expect(meta.client_meta.thumbnail_size).toEqual(thumbnailSize)
    expect(thumbnailSize.width).toBeGreaterThan(1)
    expect(meta.client_meta.render_coordinates).toEqual({ x: 49, y: 3, width: 345, height: 308 })
  })

  test('without a Cover page, the thumbnail shows the first page a person drew on', async () => {
    const { graph } = landingPage()
    // An internal page, such as the one library data lives on, listed before it.
    const internal = graph.addPage('Internal')
    graph.updateNode(internal.id, { internalOnly: true })
    graph.insertChildAt(internal.id, graph.rootId, 0)
    graph.createNode('RECTANGLE', internal.id, { x: 900, y: 900, width: 10, height: 10 })
    const { meta } = readArchive(await exportFigFile(graph, { renderHeadlessThumbnail: true }))

    expect(meta.client_meta.render_coordinates).toEqual({ x: 49, y: 3, width: 345, height: 308 })
  })

  test('describes the placeholder when no thumbnail was rendered', async () => {
    const { graph } = landingPage()
    const { meta, thumbnailSize } = readArchive(await exportFigFile(graph))

    expect(meta.file_name).toBe('Untitled')
    expect(meta.client_meta.thumbnail_size).toEqual(thumbnailSize)
    expect(meta.client_meta.render_coordinates).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  test('a reopened file keeps its meta.json until an edit writes a new one', async () => {
    const { graph, pageId } = landingPage()
    const saved = await exportFigFile(graph, {
      pageId,
      renderHeadlessThumbnail: true,
      documentName: 'Landing'
    })
    const reopened = await parseFigFile(saved.slice().buffer, { populate: 'first-page' })
    const reopenedPageId = reopened.getPages()[0].id

    expect(readArchive(await exportFigFile(reopened)).raw).toBe(readArchive(saved).raw)

    const [card] = reopened.getChildren(reopenedPageId)
    reopened.updateNode(card.id, { name: 'Edited card' })
    const { meta, thumbnailSize } = readArchive(
      await exportFigFile(reopened, {
        pageId: reopenedPageId,
        renderHeadlessThumbnail: true,
        documentName: 'Landing v2'
      })
    )

    expect(meta.file_name).toBe('Landing v2')
    expect(meta.client_meta.background_color).toEqual(BLUE_GRAY)
    expect(meta.client_meta.thumbnail_size).toEqual(thumbnailSize)
    expect(meta.client_meta.render_coordinates).toEqual({ x: 49, y: 3, width: 345, height: 308 })
  })

  test('an unchanged reopened file saved under another name changes only its meta.json name', async () => {
    const { graph, pageId } = landingPage()
    const saved = await exportFigFile(graph, {
      pageId,
      renderHeadlessThumbnail: true,
      documentName: 'Landing'
    })
    const reopened = await parseFigFile(saved.slice().buffer, { populate: 'first-page' })

    expect(await exportFigFile(reopened, { documentName: 'Landing' })).toEqual(saved)

    const renamed = await exportFigFile(reopened, { documentName: 'Landing copy' })
    expect(readArchive(renamed).meta).toEqual({
      ...readArchive(saved).meta,
      file_name: 'Landing copy'
    })
    expect(omit(unzipSync(renamed), ['meta.json'])).toEqual(omit(unzipSync(saved), ['meta.json']))
  })
})
