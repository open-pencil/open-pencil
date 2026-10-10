import * as v from 'valibot'

/** One effect of a shader preset, as the `shaders` library names it, with the effects it holds. */
export interface ShaderComponent {
  type: string
  id?: string
  props?: Record<string, unknown>
  children?: ShaderComponent[]
}

const shaderComponent: v.GenericSchema<unknown, ShaderComponent> = v.object({
  type: v.pipe(v.string(), v.nonEmpty(), v.maxLength(100)),
  id: v.optional(v.string()),
  props: v.optional(v.record(v.string(), v.unknown())),
  children: v.optional(v.array(v.lazy(() => shaderComponent)))
})

/**
 * A shader as the `shaders` library describes it and shaders.com exports it: a tree of effects,
 * drawn first to last.
 */
export const shaderPresetSchema = v.object({
  components: v.pipe(v.array(shaderComponent), v.minLength(1)),
  structureVersion: v.optional(v.number())
})

export type ShaderPreset = v.InferOutput<typeof shaderPresetSchema>

/**
 * A paint that draws a shader. The paint itself is an image fill of the shader's still frame, so
 * every format and renderer that reads images shows it; this entry says which image it is, the
 * preset that draws it, and the layer size the frame was rendered at, which is missing until it
 * is rendered for the current preset.
 */
export const shaderPaintSchema = v.object({
  image: v.pipe(v.string(), v.nonEmpty()),
  preset: shaderPresetSchema,
  frame: v.optional(
    v.object({
      width: v.pipe(v.number(), v.finite(), v.minValue(0)),
      height: v.pipe(v.number(), v.finite(), v.minValue(0))
    })
  )
})

export type ShaderPaint = v.InferOutput<typeof shaderPaintSchema>
