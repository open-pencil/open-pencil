import { describe, expect, test } from 'bun:test'

import { createEditor } from '@lawha/core'
import { SkiaRenderer } from '@lawha/core/canvas'
import { renderNodesToImage } from '@lawha/core/io/formats/raster'
import { isImportableRasterFile, imageHeader } from '@lawha/scene-graph/images'

import { getCanvasKit } from '#core/canvaskit'

/** A real W×H WebP, encoded by CanvasKit, filled with one colour. */
async function webp(width: number, height: number): Promise<Uint8Array> {
  const ck = await getCanvasKit()
  const surface = ck.MakeSurface(width, height)
  if (!surface) throw new Error('no surface')
  surface.getCanvas().clear(ck.Color(79, 70, 229, 1))
  const image = surface.makeImageSnapshot()
  const bytes = image.encodeToBytes(ck.ImageFormat.WEBP, 90)
  image.delete()
  surface.delete()
  if (!bytes) throw new Error('WebP encoding failed')
  return bytes
}

const isWebP = (b: Uint8Array) =>
  String.fromCharCode(...b.slice(0, 4)) === 'RIFF' &&
  String.fromCharCode(...b.slice(8, 12)) === 'WEBP'

describe('importable raster files', () => {
  test.each([
    ['photo.webp', 'image/webp', true],
    ['photo.webp', '', true], // a picker that reports no type
    ['PHOTO.WEBP', 'application/octet-stream', true],
    ['photo.jpeg', '', true],
    ['photo.avif', 'image/avif', true],
    ['notes.txt', '', false],
    ['photo.webp.txt', '', false],
    ['photo.webp', 'text/plain', false] // a declared type wins over the name
  ])('%s (%p) importable: %p', (name, type, expected) => {
    expect(isImportableRasterFile({ name, type })).toBe(expected)
  })
})

describe('WebP import', () => {
  test('a dropped WebP becomes an image layer at its pixel size', async () => {
    const bytes = await webp(120, 80)
    expect(imageHeader(bytes)).toEqual({ type: 'image/webp', width: 120, height: 80 })
    const editor = createEditor()
    await editor.placeFiles([new File([bytes], 'photo.webp', { type: 'image/webp' })], 300, 200)
    const [node] = editor.graph.getChildren(editor.state.currentPageId)
    expect(node).toMatchObject({ width: 120, height: 80 })
    expect(node.fills[0]?.type).toBe('IMAGE')
  })

  test('a WebP with no media type is still placed', async () => {
    const editor = createEditor()
    await editor.placeFiles([new File([await webp(64, 32)], 'shot.webp', { type: '' })], 0, 0)
    const roots = editor.graph.getChildren(editor.state.currentPageId)
    expect(roots).toHaveLength(1)
    expect(roots[0]).toMatchObject({ width: 64, height: 32 })
  })
})

describe('WebP export', () => {
  test('exporting a frame as WebP writes a decodable WebP at the frame size × scale', async () => {
    const editor = createEditor()
    const ck = await getCanvasKit()
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 200,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const surface = ck.MakeSurface(1, 1)
    if (!surface) throw new Error('no surface')
    const renderer = new SkiaRenderer(ck, surface)
    const bytes = renderNodesToImage(
      ck,
      renderer,
      editor.graph,
      editor.state.currentPageId,
      [frame.id],
      {
        scale: 2,
        format: 'WEBP'
      }
    )
    if (!bytes) throw new Error('nothing rendered')
    expect(isWebP(bytes)).toBe(true)
    expect(imageHeader(bytes)).toEqual({ type: 'image/webp', width: 400, height: 200 })
    const decoded = ck.MakeImageFromEncoded(bytes)
    expect(decoded?.width()).toBe(400)
    decoded?.delete()
  })
})
