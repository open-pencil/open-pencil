import { TRANSPARENT } from '../constants'
import { readAllPluginData, withAllPluginData } from '../plugin-data/field'
import { OPEN_PENCIL_PLUGIN_DATA } from '../plugin-data/fields'
import { randomHex } from '../random'
import type { Fill, SceneNode } from '../types'
import type { ShaderPaint, ShaderPreset } from './schema'

/** What shader paints read of a node. */
type ShaderNode = Pick<SceneNode, 'fills' | 'strokes' | 'pluginData'>

/** Every shader a node's fills and strokes draw, whether or not a paint still shows it. */
export function readShaderPaints(node: Pick<SceneNode, 'pluginData'>): ShaderPaint[] {
  return readAllPluginData(node.pluginData, OPEN_PENCIL_PLUGIN_DATA.shader)
}

/**
 * The shader a fill or stroke of `node` draws: an image paint whose image is a shader's frame.
 * Null for any other paint, including one whose image was replaced, which then draws as the
 * image it holds.
 */
export function shaderOfPaint(
  node: Pick<SceneNode, 'pluginData'>,
  paint: Fill
): ShaderPaint | null {
  if (paint.type !== 'IMAGE' || !paint.imageHash) return null
  return readShaderPaints(node).find((shader) => shader.image === paint.imageHash) ?? null
}

/** Whether any paint of `node` draws a shader. */
export function hasShaderPaint(node: ShaderNode): boolean {
  return [...node.fills, ...node.strokes].some((paint) => shaderOfPaint(node, paint) !== null)
}

/**
 * The node's plugin data with `shaders` set by their image, keeping only shaders a fill or
 * stroke of `paints` still shows, so removing or replacing a paint leaves no entry behind.
 */
export function withShaderPaints(
  node: Pick<SceneNode, 'pluginData'>,
  paints: readonly Fill[],
  shaders: readonly ShaderPaint[] = []
): SceneNode['pluginData'] {
  const shown = new Set(
    paints.flatMap((paint) => (paint.type === 'IMAGE' && paint.imageHash ? [paint.imageHash] : []))
  )
  const byImage = new Map(readShaderPaints(node).map((shader) => [shader.image, shader]))
  for (const shader of shaders) byImage.set(shader.image, shader)
  return withAllPluginData(
    node.pluginData,
    OPEN_PENCIL_PLUGIN_DATA.shader,
    [...byImage.values()].filter((shader) => shown.has(shader.image))
  )
}

/**
 * A new paint that draws `preset`, and the shader entry it shows. Its image names a frame not yet
 * rendered, unique to this paint, so no other paint's entry claims it until the frame is drawn.
 */
export function createShaderPaint(preset: ShaderPreset): {
  paint: Fill
  shader: ShaderPaint
} {
  const image = randomHex(20)
  return {
    paint: {
      type: 'IMAGE',
      color: TRANSPARENT,
      opacity: 1,
      visible: true,
      imageHash: image,
      imageScaleMode: 'FILL'
    },
    shader: { image, preset: structuredClone(preset) }
  }
}

/** Whether a shader's frame was rendered for its preset at the size `node` has now. */
export function isShaderFrameCurrent(
  shader: ShaderPaint,
  size: { width: number; height: number }
): boolean {
  const { frame } = shader
  return (
    frame !== undefined &&
    Math.round(frame.width) === Math.round(size.width) &&
    Math.round(frame.height) === Math.round(size.height)
  )
}
