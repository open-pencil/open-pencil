import { describe, expect, test } from 'bun:test'

import { unzipSync } from 'fflate'
import { reactive } from 'vue'

import { createDefaultEditorState, createEditor, type DocumentKind } from '@open-pencil/core/editor'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { createEmptyDeckGraph } from '@open-pencil/deck'
import { SceneGraph } from '@open-pencil/scene-graph'

import { createDocumentSourceActions, createDocumentSourceState } from '@/app/document/io/source'
import { isUsableStorageThumbnail } from '@/app/storage/thumbnail'

const THUMBNAIL_WIDTH = 400
const THUMBNAIL_HEIGHT = 225

/**
 * The save path with no live renderer — closing a tab, leaving for the
 * workspace, or saving a tab that is open but not the one the canvas serves.
 *
 * Wired the way `createDocumentIOActions` wires it, minus the file watcher, so
 * the assertion covers what the app actually asks the exporter for rather than
 * what the exporter is capable of.
 */
function createRendererlessSource(graph: SceneGraph, documentKind: DocumentKind) {
  const state = reactive({
    ...createDefaultEditorState(graph.getPages()[0].id),
    documentKind,
    documentName: 'Preview',
    autosaveEnabled: false
  })
  const editor = createEditor({ graph, state })
  return createDocumentSourceActions({
    editor,
    state,
    stopWatchingFile: () => undefined,
    startWatchingFile: () => Promise.resolve(),
    // The canvas is gone (or was never this tab's). This is the whole point.
    getRenderer: () => editor.renderer,
    ...createDocumentSourceState()
  })
}

function readThumbnail(archiveBytes: Uint8Array): Uint8Array {
  const archive = unzipSync(archiveBytes, { filter: (file) => file.name === 'thumbnail.png' })
  const thumbnail = archive['thumbnail.png']
  if (!thumbnail) throw new Error('Archive carried no thumbnail.png')
  return thumbnail
}

/** Decoded size plus how many distinct colours the preview holds. */
async function inspectPng(png: Uint8Array) {
  const ck = await initCanvasKit()
  const image = ck.MakeImageFromEncoded(png)
  if (!image) throw new Error('Thumbnail PNG did not decode')
  const width = image.width()
  const height = image.height()
  const surface = ck.MakeSurface(width, height)
  if (!surface) throw new Error('Could not create CanvasKit surface')
  try {
    const canvas = surface.getCanvas()
    canvas.drawImage(image, 0, 0)
    const pixels = canvas.readPixels(0, 0, {
      alphaType: ck.AlphaType.Unpremul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB,
      width,
      height
    })
    if (!(pixels instanceof Uint8Array)) throw new Error('Could not read thumbnail pixels')
    const colours = new Set<number>()
    for (let index = 0; index + 3 < pixels.length; index += 4) {
      colours.add(
        (pixels[index] << 24) |
          (pixels[index + 1] << 16) |
          (pixels[index + 2] << 8) |
          pixels[index + 3]
      )
    }
    return { width, height, colours: colours.size }
  } finally {
    surface.delete()
    image.delete()
  }
}

async function expectRealPreview(archiveBytes: Uint8Array): Promise<void> {
  const thumbnail = readThumbnail(archiveBytes)
  // Rejects the 1x1 placeholder the exporter falls back to.
  expect(isUsableStorageThumbnail(thumbnail)).toBe(true)

  const { width, height, colours } = await inspectPng(thumbnail)
  expect([width, height]).toEqual([THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT])
  // A full-size preview can still be blank, which is indistinguishable from a
  // real one everywhere downstream. Content means more than one colour.
  expect(colours).toBeGreaterThan(1)
}

function deckGraphWithContent(): SceneGraph {
  const graph = createEmptyDeckGraph()
  const pageId = graph.getPages()[0].id
  const artboard = graph.getChildren(pageId)[0]
  graph.createNode('RECTANGLE', artboard?.id ?? pageId, {
    x: 200,
    y: 200,
    width: 600,
    height: 400,
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.4, b: 0.9, a: 1 }, visible: true, opacity: 1 }]
  })
  return graph
}

function designGraphWithContent(): SceneGraph {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  graph.createNode('RECTANGLE', pageId, {
    x: 0,
    y: 0,
    width: 320,
    height: 180,
    fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.2, b: 0.2, a: 1 }, visible: true, opacity: 1 }]
  })
  return graph
}

describe('saving without a live renderer', () => {
  test('a deck still carries a real preview', async () => {
    const source = createRendererlessSource(deckGraphWithContent(), 'deck')
    try {
      await expectRealPreview(await source.exportNativeDocument())
    } finally {
      source.disposeDocumentIO()
    }
  })

  test('a design still carries a real preview', async () => {
    const source = createRendererlessSource(designGraphWithContent(), 'design')
    try {
      await expectRealPreview(await source.exportNativeDocument())
    } finally {
      source.disposeDocumentIO()
    }
  })
})
