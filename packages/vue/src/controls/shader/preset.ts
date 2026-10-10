import * as v from 'valibot'

import { shaderPresetSchema, type ShaderPreset } from '@open-pencil/scene-graph'

/**
 * Edits of a shader preset's stack of effects. The effects at the top level draw first to last,
 * each over the ones before it; every edit returns a new preset.
 */

/** The effect a new shader paint, or a new effect in one, starts with. */
export const DEFAULT_SHADER_EFFECT = 'Aurora'

/** The preset a new shader paint starts with. */
export const DEFAULT_SHADER_PRESET: ShaderPreset = { components: [{ type: DEFAULT_SHADER_EFFECT }] }

/** `preset` with the effect `type` added on top, drawn with its default props. */
export function addShaderEffect(preset: ShaderPreset, type: string): ShaderPreset {
  return { ...preset, components: [...preset.components, { type }] }
}

/** `preset` without its effect at `index`; the last effect stays, since a shader needs one. */
export function removeShaderEffect(preset: ShaderPreset, index: number): ShaderPreset {
  if (preset.components.length <= 1) return preset
  return { ...preset, components: preset.components.filter((_, at) => at !== index) }
}

/** `preset` with its effect at `from` moved to `to`. */
export function moveShaderEffect(preset: ShaderPreset, from: number, to: number): ShaderPreset {
  const components = [...preset.components]
  const [moved] = components.splice(from, 1)
  if (!moved || to < 0 || to > components.length) return preset
  components.splice(to, 0, moved)
  return { ...preset, components }
}

/** `preset` with prop `key` of its effect at `index` set to `value`. */
export function setShaderEffectProp(
  preset: ShaderPreset,
  index: number,
  key: string,
  value: unknown
): ShaderPreset {
  return {
    ...preset,
    components: preset.components.map((component, at) =>
      at === index ? { ...component, props: { ...component.props, [key]: value } } : component
    )
  }
}

/** A preset written out as JSON, as shaders.com exports it. */
export function shaderPresetJSON(preset: ShaderPreset): string {
  return JSON.stringify(preset, null, 2)
}

/** The preset `text` describes, or null when it is not one: an export from shaders.com, say. */
export function parseShaderPreset(text: string): ShaderPreset | null {
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), shaderPresetSchema), text)
  return parsed.success ? parsed.output : null
}
