import type { RGBAImage } from '#core/io/formats/raster/pixels'

/**
 * How much an image's shapes cover each pixel of a `width` by `height` box, as darkness on white
 * (255 minus alpha), the image centered in the box: what whaticon hashes, whatever the shapes'
 * color. An image larger than the box is cut to its middle.
 */
export function coverageGrid(image: RGBAImage, width: number, height: number): Uint8Array {
  const grid = new Uint8Array(width * height).fill(255)
  const left = Math.floor((width - image.width) / 2)
  const top = Math.floor((height - image.height) / 2)
  for (let y = Math.max(0, -top); y < Math.min(image.height, height - top); y++) {
    for (let x = Math.max(0, -left); x < Math.min(image.width, width - left); x++) {
      grid[(top + y) * width + left + x] = 255 - (image.data[(y * image.width + x) * 4 + 3] ?? 0)
    }
  }
  return grid
}

/**
 * How alike two coverage grids of one size draw, from 0 to 1: their difference against the ink
 * either has, so the white around two icons does not make them alike, and a shape that differs
 * in one part counts as much in a small icon as in a large one.
 */
export function coverageSimilarity(a: Uint8Array, b: Uint8Array): number {
  let difference = 0
  let ink = 0
  for (let i = 0; i < a.length; i++) {
    const [left, right] = [a[i] ?? 255, b[i] ?? 255]
    difference += Math.abs(left - right)
    ink += 255 - Math.min(left, right)
  }
  return ink === 0 ? 1 : 1 - difference / ink
}
