import type { SceneNode } from '../types'

/** Placement/orientation only; dimensions are a separate geometry contract. */
export const TRANSFORM_FIELDS = [
  'x',
  'y',
  'rotation',
  'flipX',
  'flipY'
] as const satisfies readonly (keyof SceneNode)[]
export const SIZE_FIELDS = ['width', 'height'] as const satisfies readonly (keyof SceneNode)[]
