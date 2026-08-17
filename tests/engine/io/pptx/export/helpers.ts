import { expect } from 'bun:test'

import { unzipSync } from 'fflate'

import { decodeBase64 } from '@open-pencil/core/bytes'
import type { Fill, Stroke } from '@open-pencil/scene-graph'
import { SceneGraph } from '@open-pencil/scene-graph'

// 1x1 transparent PNG — stub rasterizer output so unit tests avoid CanvasKit.
export const TINY_PNG = decodeBase64(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
)

export const stubRasterize = () => Promise.resolve(TINY_PNG)

export function makeGraph(): SceneGraph {
  return new SceneGraph()
}

export function solidFill(r: number, g: number, b: number, a = 1): Fill {
  return { type: 'SOLID', color: { r, g, b, a }, opacity: 1, visible: true }
}

export function solidStroke(r: number, g: number, b: number, a = 1, weight = 2): Stroke {
  return { color: { r, g, b, a }, weight, opacity: 1, visible: true, align: 'CENTER' }
}

export function pageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

export function makeSlideFrame(graph: SceneGraph, name: string) {
  return graph.createNode('FRAME', pageId(graph), {
    name,
    width: 1280,
    height: 720,
    fills: [solidFill(1, 1, 1)]
  })
}

export function unzipPPTX(data: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(data)
}

export function slideXML(files: Record<string, Uint8Array>, index: number): string {
  const entry = files[`ppt/slides/slide${index}.xml`]
  expect(entry).toBeDefined()
  return new TextDecoder().decode(entry)
}

export const EMU_PER_INCH = 914400
export const SLIDE_WIDTH_IN = 13.333

/** Slide frames in these tests are 1280px wide, so px → in uses that scale. */
export function inches(px: number): number {
  return px / (1280 / SLIDE_WIDTH_IN)
}

export interface Placement {
  /** degrees, clockwise */
  rot: number
  centerX: number
  centerY: number
  width: number
  height: number
}

/** Element placements (inches) read back from the slide XML. */
export function placements(xml: string): Placement[] {
  const pattern =
    /<a:xfrm(?: rot="(-?\d+)")?><a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(-?\d+)" cy="(-?\d+)"\/><\/a:xfrm>/g
  return [...xml.matchAll(pattern)].map((match) => {
    const [x, y, width, height] = match.slice(2).map((value) => Number(value) / EMU_PER_INCH)
    return {
      rot: Number(match[1] ?? 0) / 60000,
      centerX: x + width / 2,
      centerY: y + height / 2,
      width,
      height
    }
  })
}
