import { fromUint8Array } from 'js-base64'
import pixelmatch from 'pixelmatch'
import * as v from 'valibot'

import type { FigmaAPI } from '#core/figma-api'
import { computeContentBounds, type RGBAImage } from '#core/io/formats/raster'
import { findPageId } from '#core/io/subgraph'
import { nodeComparisonInput, toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'
import { boundedRasterScale, rasterScaleInputs } from '#core/tools/vector/export'

/** pixelmatch paints mismatches in this color over a faded grayscale copy of the source. */
const DIFF_COLOR: [number, number, number] = [255, 0, 0]

interface Rendered {
  image: RGBAImage
  /** World coordinates of pixel (0, 0). */
  originX: number
  originY: number
}

async function renderNode(
  figma: FigmaAPI,
  id: string,
  scale: number
): Promise<Rendered | { error: string }> {
  const pageId = findPageId(figma.graph, id)
  const bounds = computeContentBounds(figma.graph, [id])
  if (!pageId || !bounds) return { error: `Node "${id}" has no visible content` }
  const bytes = await figma.exportImage?.([id], { scale, format: 'PNG', pageId })
  const image = bytes ? figma.rasterCodec?.decode(bytes) : null
  if (!image) return { error: `Node "${id}" could not be rendered` }
  return { image, originX: bounds.minX, originY: bounds.minY }
}

/** Copy into a transparent canvas of the given size, so differently sized renders compare. */
function padImage(image: RGBAImage, width: number, height: number): Uint8Array {
  if (image.width === width && image.height === height) return image.data
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < image.height; y++) {
    const row = image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4)
    data.set(row, y * width * 4)
  }
  return data
}

function changedPixelBounds(output: Uint8Array, width: number, height: number) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      if (
        output[offset] !== DIFF_COLOR[0] ||
        output[offset + 1] !== DIFF_COLOR[1] ||
        output[offset + 2] !== DIFF_COLOR[2]
      ) {
        continue
      }
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + 1)
      maxY = Math.max(maxY, y + 1)
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export const diffVisual = defineTool({
  name: 'diff_visual',
  description:
    'Pixel diff between two rendered nodes. Returns a PNG with changed pixels in red over a faded copy of the source, the changed pixel ratio, and the changed region in source-node coordinates. Use it to confirm an edit only touched the intended area.',
  execution: { kind: 'async', mutation: 'none' },
  input: v.object({
    ...nodeComparisonInput.entries,
    ...rasterScaleInputs,
    threshold: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.minValue(0),
          v.maxValue(1),
          v.description('Per-pixel color tolerance from 0 to 1; smaller is stricter (default: 0.1)')
        )
      ),
      0.1
    )
  }),
  execute: async (figma, args) => {
    if (!figma.exportImage || !figma.rasterCodec) {
      return { error: 'Visual diff is not available in this environment' }
    }
    const fromNode = figma.graph.getNode(args.from)
    if (!fromNode) return { error: `Node "${args.from}" not found` }
    if (!figma.graph.getNode(args.to)) return { error: `Node "${args.to}" not found` }

    const fromBounds = computeContentBounds(figma.graph, [args.from])
    const toBounds = computeContentBounds(figma.graph, [args.to])
    if (!fromBounds || !toBounds) return { error: 'Both nodes need visible content to compare' }
    // One scale for both sides, so equal designs produce equal pixels.
    const scale = boundedRasterScale(
      Math.max(fromBounds.maxX - fromBounds.minX, toBounds.maxX - toBounds.minX),
      Math.max(fromBounds.maxY - fromBounds.minY, toBounds.maxY - toBounds.minY),
      args.scale,
      args.maxEdge
    )
    if (scale <= 0) return { error: 'Both nodes need visible content to compare' }

    const before = await renderNode(figma, args.from, scale)
    if ('error' in before) return before
    const after = await renderNode(figma, args.to, scale)
    if ('error' in after) return after

    const width = Math.max(before.image.width, after.image.width)
    const height = Math.max(before.image.height, after.image.height)
    const output = new Uint8Array(width * height * 4)
    const changedPixels = pixelmatch(
      padImage(before.image, width, height),
      padImage(after.image, width, height),
      output,
      width,
      height,
      { threshold: args.threshold, diffColor: DIFF_COLOR }
    )
    const png = figma.rasterCodec.encodePNG({ width, height, data: output })
    if (!png) return { error: 'Visual diff image could not be encoded' }

    const pixels = changedPixelBounds(output, width, height)
    const origin = figma.graph.getAbsolutePosition(args.from)
    const totalPixels = width * height
    return {
      mimeType: 'image/png',
      base64: fromUint8Array(png),
      byteLength: png.length,
      width,
      height,
      scale,
      changedPixels,
      totalPixels,
      changedRatio:
        totalPixels > 0 ? Math.round((changedPixels / totalPixels) * 10_000) / 10_000 : 0,
      changedBounds: pixels
        ? {
            x: round(before.originX - origin.x + pixels.minX / scale),
            y: round(before.originY - origin.y + pixels.minY / scale),
            width: round((pixels.maxX - pixels.minX) / scale),
            height: round((pixels.maxY - pixels.minY) / scale)
          }
        : null,
      sizeChanged:
        before.image.width !== after.image.width || before.image.height !== after.image.height
    }
  }
})
