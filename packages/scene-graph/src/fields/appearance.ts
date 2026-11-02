import type { SceneNode } from '../types'

/** What a layer is painted with, and how it blends. */
export const PAINT_FIELDS = [
  'fills',
  'strokes',
  'effects',
  'opacity',
  'blendMode'
] as const satisfies readonly (keyof SceneNode)[]

/** How strokes are drawn, beside their paints. */
export const STROKE_FIELDS = [
  'strokeWeight',
  'strokeAlign',
  'strokeCap',
  'strokeJoin',
  'strokeMiterLimit',
  'dashPattern',
  'independentStrokeWeights',
  'borderTopWeight',
  'borderRightWeight',
  'borderBottomWeight',
  'borderLeftWeight'
] as const satisfies readonly (keyof SceneNode)[]

export const CORNER_FIELDS = [
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius',
  'independentCorners',
  'cornerSmoothing'
] as const satisfies readonly (keyof SceneNode)[]
