import type { Canvas } from '@open-pencil/canvaskit'
import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import { UNSET_TEXTURE } from '@open-pencil/scene-graph/constants'
import { isLayerContainer } from '@open-pencil/scene-graph/node-defaults'

import { compiledProgram } from '#core/canvas/renderer/shaders'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { defineShader } from '#core/canvas/sksl'

import clipSource from './clip.sksl?raw'

/** Keeps a moved layer within what it covered, as Figma's clipped texture does. */
const TEXTURE_CLIP = defineShader('texture clip', clipSource)

/** Octaves of fractal noise a texture's grain sums, as Figma's SVG export writes it. */
const TEXTURE_OCTAVES = 3

/** The texture a layer draws with: the first visible one, as Figma keeps one per layer. */
export function visibleTexture(node: SceneNode): Effect | undefined {
  return node.effects.find((effect) => effect.visible && effect.type === 'TEXTURE')
}

/**
 * Starts drawing a layer's content through its texture, in the layer's own units: fractal noise
 * of one cycle per grain moves each pixel by up to the radius, as Figma's displacement does.
 * Clipped to its shape, the moved content replaces the unmoved wherever it lands and stays within
 * what the layer covered, so the edges roughen inward without opening holes. Returns how many
 * saves `endTexture` undoes.
 */
export function beginTexture(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  texture: Effect
): number {
  const grain = texture.texture ?? UNSET_TEXTURE
  const radius = texture.radius
  if (radius <= 0) return 0
  const frequency = (size: number) => (size > 0 ? 1 / size : 0)
  const noise = r.ck.Shader.MakeFractalNoise(
    frequency(grain.noiseSize.x),
    frequency(grain.noiseSize.y),
    TEXTURE_OCTAVES,
    grain.seed ?? 0,
    0,
    0
  )
  const map = r.ck.ImageFilter.MakeShader(noise)
  const displaced = r.ck.ImageFilter.MakeDisplacementMap(
    r.ck.ColorChannel.Red,
    r.ck.ColorChannel.Green,
    radius * 2,
    map,
    null
  )
  const clip = compiledProgram(r.ck, r.shaders, TEXTURE_CLIP)
  const filter = grain.clipToShape
    ? r.ck.ImageFilter.MakeRuntimeShaderWithInputs(
        clip.effect,
        clip.uniforms({}),
        { source: null, displaced },
        0
      )
    : displaced
  r.effectLayerPaint.setImageFilter(filter)
  canvas.saveLayer(
    r.effectLayerPaint,
    r.ck.LTRBRect(-radius, -radius, node.width + radius, node.height + radius)
  )
  r.effectLayerPaint.setImageFilter(null)
  for (const made of [filter, displaced, map, noise]) if (made && !made.isDeleted()) made.delete()
  return 1
}

/** Ends what `beginTexture` started, drawing the textured content. */
export function endTexture(canvas: Canvas, saves: number): void {
  for (let i = 0; i < saves; i++) canvas.restore()
}

/**
 * Draws a shape's own content through its texture: its fills, strokes, and inner shadows, not
 * its shadows behind or its noise over it, as in Figma. A frame or group textures its children
 * too, which `renderNode` does around them.
 */
export function withLeafTexture(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  draw: () => void
): void {
  const texture = isLayerContainer(node) ? undefined : visibleTexture(node)
  const saves = texture ? beginTexture(r, canvas, node, texture) : 0
  draw()
  endTexture(canvas, saves)
}
