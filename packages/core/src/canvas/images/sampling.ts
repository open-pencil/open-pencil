import type { Image, Shader } from 'canvaskit-wasm'

import type { Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import type { SkiaRenderer } from '#core/canvas/renderer'

const SCALE_TOLERANCE = 1e-6
const PIXEL_TOLERANCE = 1e-3

function isUnitScale(value: number): boolean {
  return Math.abs(Math.abs(value) - 1) < SCALE_TOLERANCE
}

function isZero(value: number): boolean {
  return Math.abs(value) < SCALE_TOLERANCE
}

function isWholePixel(value: number): boolean {
  return Math.abs(value - Math.round(value)) < PIXEL_TOLERANCE
}

/** Smoothing a supersampled export's 1:1 image blurs it where Figma keeps it sharp. */
export function landsOnOutputPixels(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph,
  localMatrix: number[]
): boolean {
  const output = r.images.supersampledOutput
  if (!output) {
    return false
  }
  const [xx, xy, tx, yx, yy, ty] = Matrix.multiply(
    output.outputFromWorld,
    getWorldMatrix(node, graph),
    localMatrix
  )
  const upright = isUnitScale(xx) && isUnitScale(yy) && isZero(xy) && isZero(yx)
  const quarterTurned = isZero(xx) && isZero(yy) && isUnitScale(xy) && isUnitScale(yx)
  return (upright || quarterTurned) && isWholePixel(tx) && isWholePixel(ty)
}

/** A picture a shader lays out later lands off the output's pixel grid, wherever it is drawn. */
export function drawOffOutputGrid<T>(r: SkiaRenderer, draw: () => T): T {
  const output = r.images.supersampledOutput
  r.images.supersampledOutput = null
  try {
    return draw()
  } finally {
    r.images.supersampledOutput = output
  }
}

function imageTileMode(r: SkiaRenderer, scaleMode: NonNullable<Fill['imageScaleMode']>) {
  if (scaleMode === 'TILE') {
    return r.ck.TileMode.Repeat
  }
  return scaleMode === 'FIT' ? r.ck.TileMode.Decal : r.ck.TileMode.Clamp
}

export function makeImageShader(
  r: SkiaRenderer,
  img: Image,
  scaleMode: NonNullable<Fill['imageScaleMode']>,
  localMatrix: number[],
  pixelExact: boolean
): Shader {
  const { FilterMode, MipmapMode } = r.ck
  const tileMode = imageTileMode(r, scaleMode)
  if (pixelExact) {
    return img.makeShaderOptions(
      tileMode,
      tileMode,
      FilterMode.Nearest,
      MipmapMode.None,
      localMatrix
    )
  }
  if (scaleMode === 'TILE') {
    return img.makeShaderCubic(tileMode, tileMode, 1 / 3, 1 / 3, localMatrix)
  }
  return img.makeShaderOptions(
    tileMode,
    tileMode,
    FilterMode.Linear,
    MipmapMode.Linear,
    localMatrix
  )
}
