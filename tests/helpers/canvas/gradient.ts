import type { Fill, GradientTransform, SceneGraph } from '@open-pencil/scene-graph'

type GradientType = 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND'

/**
 * Figma's identity transform for each kind: linear from the left edge's middle to the right's, the
 * others centred and filling the layer.
 */
const IDENTITY: GradientTransform = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
const TRANSFORMS: Record<GradientType, GradientTransform> = {
  GRADIENT_LINEAR: IDENTITY,
  GRADIENT_RADIAL: IDENTITY,
  GRADIENT_ANGULAR: IDENTITY,
  GRADIENT_DIAMOND: IDENTITY
}

/** A 200 × 140 rectangle at the origin with a red, yellow, and blue gradient fill. */
export function createGradientScene(graph: SceneGraph, pageId: string, type: GradientType) {
  const fill: Fill = {
    type,
    visible: true,
    opacity: 1,
    color: { r: 0, g: 0, b: 0, a: 1 },
    gradientTransform: TRANSFORMS[type],
    gradientStops: [
      { position: 0, color: { r: 1, g: 0.3, b: 0.2, a: 1 } },
      { position: 0.5, color: { r: 1, g: 0.85, b: 0.2, a: 1 } },
      { position: 1, color: { r: 0.2, g: 0.4, b: 1, a: 1 } }
    ]
  }
  const node = graph.createNode('RECTANGLE', pageId, {
    name: 'Gradient',
    x: 0,
    y: 0,
    width: 200,
    height: 140,
    fills: [fill]
  })
  return { nodeId: node.id }
}
