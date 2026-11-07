import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { headlessRenderNodes, scaleToFit } from '@open-pencil/core/io/formats/raster'
import {
  createLibraryRevision,
  createSelectiveLibraryRevision,
  deserializeLibraryRevision,
  diffLibraryManifests,
  encodeStoredLibraryRevision,
  LIBRARY_THUMBNAIL_SIZE,
  storedLibraryRevisionSchema,
  validateLibraryRevision
} from '@open-pencil/core/library'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'

const RED = { r: 1, g: 0, b: 0, a: 1 }
const BLUE = { r: 0, g: 0, b: 1, a: 1 }

function solid(): Fill {
  return { type: 'SOLID', color: RED, opacity: 1, visible: true }
}

/** A design system: a primitives collection, a semantic one aliasing it, a style, a button. */
function designSystem() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const primitives = graph.createCollection('Primitives')
  const semantic = graph.createCollection('Semantic')
  const red = graph.createVariable('red', 'COLOR', primitives.id, RED)
  const accent = graph.createVariable('accent', 'COLOR', semantic.id, { aliasId: red.id })
  const style = graph.createNode('RECTANGLE', page.id, {
    name: 'Surface',
    sharedStyleType: 'FILL',
    fills: [solid()]
  })
  style.source.id = 'S:surface,'
  const button = graph.createNode('COMPONENT', page.id, {
    name: 'Button',
    componentKey: 'button',
    fills: [solid()],
    strokeStyleId: 'S:surface,'
  })
  graph.bindVariable(button.id, 'fills/0/color', accent.id)
  return { graph, primitives, semantic, red, accent, style, button }
}

function assetsByType(revision: Awaited<ReturnType<typeof createLibraryRevision>>) {
  return revision.manifest.assets.map((asset) => `${asset.type}:${asset.name}`).sort()
}

describe('library revisions publish styles and variables', () => {
  test('carry the variables a component binds, with those they alias', async () => {
    const { graph, red, accent, button } = designSystem()

    const revision = await createLibraryRevision({ libraryId: 'ds', name: 'DS', graph })

    const published = [...revision.graph.getAllNodes()].find((node) => node.name === 'Button')
    expect(published?.boundVariables['fills/0/color']).toBe(accent.id)
    expect(revision.graph.variables.get(accent.id)?.valuesByMode).toEqual(accent.valuesByMode)
    expect(revision.graph.variables.has(red.id)).toBe(true)
    expect(button.id).not.toBe(published?.id)
  })

  test('list each style and collection as an asset beside the components', async () => {
    const { graph } = designSystem()

    const revision = await createLibraryRevision({ libraryId: 'ds', name: 'DS', graph })

    expect(assetsByType(revision)).toEqual([
      'COMPONENT:Button',
      'STYLE:Surface',
      'VARIABLE_COLLECTION:Primitives',
      'VARIABLE_COLLECTION:Semantic'
    ])
    const style = revision.manifest.assets.find((asset) => asset.type === 'STYLE')
    expect(style?.key).toMatch(/^[0-9a-f]{40}$/)
  })

  test('leave out a style layer no layer can link to', async () => {
    const { graph, style } = designSystem()
    graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: 'Loose',
      sharedStyleType: 'FILL'
    })

    const revision = await createLibraryRevision({ libraryId: 'ds', name: 'DS', graph })

    const styles = revision.manifest.assets.filter((asset) => asset.type === 'STYLE')
    expect(styles.map((asset) => asset.name)).toEqual([style.name])
  })

  test('keep the ID a style read from a file is linked by', async () => {
    await initCodec()
    const file = await parseFigFile(
      (await exportFigFile(designSystem().graph)).slice().buffer as ArrayBuffer
    )

    const revision = await createLibraryRevision({ libraryId: 'ds', name: 'DS', graph: file })

    const nodes = [...revision.graph.getAllNodes()]
    const style = nodes.find((node) => node.sharedStyleType === 'FILL')
    const button = nodes.find((node) => node.name === 'Button')
    expect(style?.source.id).toBeTruthy()
    expect(button?.strokeStyleId).toBe(style?.source.id)
  })

  test('mark a changed token as a change to its collection, not to the components using it', async () => {
    const { graph, primitives, red } = designSystem()
    const first = await createLibraryRevision({ libraryId: 'ds', name: 'DS', graph })
    graph.variables.set(red.id, { ...red, valuesByMode: { [primitives.defaultModeId]: BLUE } })

    const second = await createLibraryRevision({
      libraryId: 'ds',
      name: 'DS',
      graph,
      previousRevisionId: first.manifest.revisionId
    })

    expect(
      diffLibraryManifests(first.manifest, second.manifest).map(
        (change) => `${change.kind}:${change.asset.name}`
      )
    ).toEqual(['modified:Primitives'])
  })

  test('keep an unpublished collection change out of a selective revision', async () => {
    const { graph, primitives, red, button } = designSystem()
    const first = await createLibraryRevision({ libraryId: 'ds', name: 'DS', graph })
    graph.variables.set(red.id, { ...red, valuesByMode: { [primitives.defaultModeId]: BLUE } })
    graph.updateNode(button.id, { name: 'Primary button' })

    const next = await createSelectiveLibraryRevision({
      previous: first,
      sourceGraph: graph,
      selectedAssetKeys: new Set(['button']),
      name: 'DS'
    })

    expect(next.graph.variables.get(red.id)?.valuesByMode).toEqual({
      [primitives.defaultModeId]: RED
    })
    expect(next.manifest.assets.find((asset) => asset.key === 'button')?.name).toBe(
      'Primary button'
    )
  })

  test('give components a thumbnail drawn at the catalog size, leaving the revision ID alone', async () => {
    const { graph } = designSystem()
    const plain = await createLibraryRevision({ libraryId: 'ds', name: 'DS', graph })

    const pictured = await createLibraryRevision({
      libraryId: 'ds',
      name: 'DS',
      graph,
      publishedAt: plain.manifest.publishedAt,
      renderThumbnail: async (revisionGraph, pageId, nodeId) => {
        const scale = scaleToFit(revisionGraph, [nodeId], LIBRARY_THUMBNAIL_SIZE)
        return scale ? headlessRenderNodes(revisionGraph, pageId, [nodeId], { scale }) : null
      }
    })

    expect(pictured.manifest.revisionId).toBe(plain.manifest.revisionId)
    const thumbnails = pictured.manifest.assets.flatMap((asset) =>
      asset.thumbnail ? [[asset.type, asset.thumbnail] as const] : []
    )
    expect(thumbnails.map(([type]) => type)).toEqual(['COMPONENT'])
    const png = thumbnails[0][1]
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
    expect(Math.max(view.getUint32(16), view.getUint32(20))).toBe(LIBRARY_THUMBNAIL_SIZE)
  })

  test('survive storing and validate as they were published', async () => {
    const { graph } = designSystem()
    const revision = await createLibraryRevision({ libraryId: 'ds', name: 'DS', graph })

    const stored = v.parse(
      v.pipe(v.string(), v.parseJson(), storedLibraryRevisionSchema),
      JSON.stringify(encodeStoredLibraryRevision(revision))
    )
    const restored = deserializeLibraryRevision(stored)

    expect(assetsByType(restored)).toEqual(assetsByType(revision))
    await expect(validateLibraryRevision(restored)).resolves.toBeUndefined()
  })
})
