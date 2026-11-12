import { expectRgbaPixels } from '#core-tests/canvas/helpers'

import type { CanvasKit } from '@open-pencil/canvaskit'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { SkiaRenderer } from '#core/canvas/renderer'
import { renderNodesToImage } from '#core/io/formats/raster/render'

/** A saved glyph outline: move to the first point, lines through the rest, in em units. */
export function outlineCommandsBlob(points: readonly (readonly [number, number])[]): Uint8Array {
  const blob = new Uint8Array(points.length * 9 + 1)
  const view = new DataView(blob.buffer)
  for (const [index, [x, y]] of points.entries()) {
    blob[index * 9] = index === 0 ? 1 : 2
    view.setFloat32(index * 9 + 1, x, true)
    view.setFloat32(index * 9 + 5, y, true)
  }
  return blob
}

/** A unit square saved glyph outline. */
export function squareCommandsBlob(): Uint8Array {
  return outlineCommandsBlob([
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
  ])
}

/** Saved glyphs as Figma saves them, one per character with its advance, 8px apart from x 2. */
export function savedGlyphs(text: string) {
  return Array.from(text, (_, index) => ({
    commandsBlob: squareCommandsBlob(),
    x: 2 + index * 8,
    y: 12,
    fontSize: 10,
    firstCharacter: index,
    advance: 8
  }))
}

/** An opaque black solid fill list. */
export function blackFills() {
  return [{ type: 'SOLID' as const, color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
}

/**
 * A renderer whose fonts are exhausted, so text with saved glyphs draws them: baked glyphs only
 * paint once font resolution is exhausted (see renderText's readiness gate).
 */
export function derivedGlyphRenderer(ck: CanvasKit) {
  const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderer.nodeFontReadiness = () => 'exhausted'
  return { surface, renderer }
}

/** The RGBA pixels of a 1× PNG export of `nodeId`, decoded, with the image's width. */
export function exportedPixels(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  nodeId: string,
  options: { trimTransparent?: boolean } = {}
): { pixels: Uint8Array; width: number } {
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, pageId, [nodeId], {
      scale: 1,
      format: 'PNG',
      ...options
    }),
    'png'
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
  try {
    const pixels = expectRgbaPixels(
      image.readPixels(0, 0, {
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB,
        width: image.width(),
        height: image.height()
      })
    )
    return { pixels, width: image.width() }
  } finally {
    image.delete()
  }
}
