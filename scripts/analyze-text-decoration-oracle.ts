#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { initCanvasKit } from '@inkly/core/io'

import type { PixelImage } from './pixel-image'

interface ChannelSummary {
  rows: Array<{ y: number; count: number; minX: number; maxX: number }>
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null
}

const { values: opts } = parseArgs({
  options: {
    figma: {
      type: 'string',
      default: '/tmp/inkly-oracles/rich-text/derived-decorations3/figma.png'
    },
    ours: {
      type: 'string',
      default: '/tmp/inkly-oracles/rich-text/derived-decorations3/ours.png'
    }
  }
})

const figmaPath = opts.figma ?? ''
const oursPath = opts.ours ?? ''
if (!existsSync(figmaPath)) throw new Error(`Missing Figma image: ${figmaPath}`)
if (!existsSync(oursPath)) throw new Error(`Missing Inkly image: ${oursPath}`)

const figma = await loadImage(figmaPath)
const ours = await loadImage(oursPath)
const figmaSummary = summarizeDecorationPixels(figma)
const oursSummary = summarizeDecorationPixels(ours)

console.log(
  JSON.stringify(
    {
      figma: figmaSummary,
      ours: oursSummary,
      deltas: {
        red: compareBounds(figmaSummary.red.bounds, oursSummary.red.bounds),
        blue: compareBounds(figmaSummary.blue.bounds, oursSummary.blue.bounds)
      }
    },
    null,
    2
  )
)

async function loadImage(path: string): Promise<PixelImage> {
  const ck = await initCanvasKit()
  const data = await Bun.file(path).arrayBuffer()
  const image = ck.MakeImageFromEncoded(new Uint8Array(data))
  if (!image) throw new Error(`Failed to decode ${path}`)
  const width = image.width()
  const height = image.height()
  const pixels = image.readPixels(0, 0, {
    alphaType: ck.AlphaType.Unpremul,
    colorType: ck.ColorType.RGBA_8888,
    colorSpace: ck.ColorSpace.SRGB,
    width,
    height
  })
  image.delete()
  if (!pixels) throw new Error(`Failed to read pixels from ${path}`)
  return { width, height, pixels }
}

function summarizeDecorationPixels(image: PixelImage) {
  return {
    red: summarizeChannel(image, isRedDecorationPixel),
    blue: summarizeChannel(image, isBlueDecorationPixel)
  }
}

function summarizeChannel(
  image: PixelImage,
  predicate: (red: number, green: number, blue: number, alpha: number) => boolean
): ChannelSummary {
  const rows: ChannelSummary['rows'] = []
  let minX = image.width
  let minY = image.height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < image.height; y++) {
    let count = 0
    let rowMinX = image.width
    let rowMaxX = -1
    for (let x = 0; x < image.width; x++) {
      const offset = (y * image.width + x) * 4
      const red = image.pixels[offset] ?? 0
      const green = image.pixels[offset + 1] ?? 0
      const blue = image.pixels[offset + 2] ?? 0
      const alpha = image.pixels[offset + 3] ?? 0
      if (!predicate(red, green, blue, alpha)) continue
      count++
      rowMinX = Math.min(rowMinX, x)
      rowMaxX = Math.max(rowMaxX, x)
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    if (count > 0) rows.push({ y, count, minX: rowMinX, maxX: rowMaxX })
  }

  return {
    rows,
    bounds: maxX >= minX ? { minX, minY, maxX, maxY } : null
  }
}

function isRedDecorationPixel(red: number, green: number, blue: number, alpha: number): boolean {
  return alpha > 100 && red > 180 && green < 120 && blue < 120
}

function isBlueDecorationPixel(red: number, green: number, blue: number, alpha: number): boolean {
  return alpha > 100 && blue > 150 && red < 120 && green < 150
}

function compareBounds(figma: ChannelSummary['bounds'], ours: ChannelSummary['bounds']) {
  if (!figma || !ours) return null
  return {
    minX: ours.minX - figma.minX,
    minY: ours.minY - figma.minY,
    maxX: ours.maxX - figma.maxX,
    maxY: ours.maxY - figma.maxY
  }
}
