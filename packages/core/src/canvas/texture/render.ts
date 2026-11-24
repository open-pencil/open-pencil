import type { Canvas, ImageFilter, Shader } from '@open-pencil/canvaskit'
import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import { linearSRGBMatrix } from '@open-pencil/scene-graph/color'
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
 * The noise as the displacement reads it. Skia takes the noise for sRGB colors and converts it
 * into the document's space, which would move its channels and the content they displace; in
 * another space this converts it back: decoded, through that space's primaries into sRGB, and
 * encoded again, as the two share a transfer function.
 */
function displacementMap(r: SkiaRenderer, noise: Shader): ImageFilter {
  const map = r.ck.ImageFilter.MakeShader(noise)
  if (r.documentColorSpace === 'srgb') return map
  const [rr, rg, rb, gr, gg, gb, br, bg, bb] = linearSRGBMatrix(r.documentColorSpace)
  const { ColorFilter } = r.ck
  const decode = ColorFilter.MakeSRGBToLinearGamma()
  // Rows of red, green, blue, and alpha out, each over red, green, blue, alpha in and an offset.
  const primaries = ColorFilter.MakeMatrix([
    rr,
    rg,
    rb,
    0,
    0,
    gr,
    gg,
    gb,
    0,
    0,
    br,
    bg,
    bb,
    0,
    0,
    0,
    0,
    0,
    1,
    0
  ])
  const encode = ColorFilter.MakeLinearToSRGBGamma()
  const linear = ColorFilter.MakeCompose(primaries, decode)
  const back = ColorFilter.MakeCompose(encode, linear)
  const filter = r.ck.ImageFilter.MakeColorFilter(back, map)
  for (const made of [back, linear, encode, primaries, decode, map]) made.delete()
  return filter
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
  const map = displacementMap(r, noise)
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
  // The paint is shared: a mask pass may have left it blending DstIn or filtering colour.
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
  r.effectLayerPaint.setColorFilter(null)
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
  try {
    draw()
  } finally {
    endTexture(canvas, saves)
  }
}
