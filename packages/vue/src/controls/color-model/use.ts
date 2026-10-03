import { computed, ref, toValue } from 'vue'

import { colorToHexRaw, okhclToRGBA, parseColor } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import {
  applyOkHCLPatch,
  colorsEqual,
  createColorModelValue,
  createOkHCLSliderGradientModel,
  createOkHCLSliderPreviewModel,
  createSliderGradientModel,
  createSliderPreviewModel,
  normalizeOkHCLPatch,
  okhclPatchChangesColor,
  rekaToSceneColor,
  withAlpha,
  withHSBChannel,
  withHSLChannel,
  withHue,
  withRGBChannel
} from '#vue/controls/color-model/model'
import type {
  ColorFieldFormat,
  HSBChannel,
  HSLChannel,
  OkHCLChannel,
  RGBChannel,
  RekaColorValue,
  UseColorModelOptions
} from '#vue/controls/color-model/types'

/** Built-in presentation formats understood by the color model. */
export const BUILT_IN_COLOR_FORMATS = ['hex', 'rgb', 'hsl', 'hsb', 'okhcl'] as const

/**
 * Creates reactive color-space values, channel actions, and slider presentation data without
 * requiring an editor context.
 */
export function useColorModel(options: UseColorModelOptions) {
  const localFormat = ref<ColorFieldFormat>(options.defaultFormat ?? 'rgb')
  const color = computed(() => toValue(options.color))
  const sourceOkHCL = computed(() => toValue(options.okhcl))
  const value = computed(() => createColorModelValue(color.value, sourceOkHCL.value))
  const format = computed(() => toValue(options.format) ?? localFormat.value)
  const hex = computed(() => colorToHexRaw(color.value))
  const sliderPreview = computed(() => createSliderPreviewModel(value.value))
  const sliderGradient = computed(() => createSliderGradientModel(value.value))
  const okhclSliderPreview = computed(() => createOkHCLSliderPreviewModel(value.value.okhcl))
  const okhclSliderGradient = computed(() => createOkHCLSliderGradientModel(value.value.okhcl))

  function emitColor(nextColor: Color): Color {
    if (!colorsEqual(color.value, nextColor)) options.onUpdate?.(nextColor)
    return nextColor
  }

  function updateHex(input: string) {
    const parsed = parseColor(input.startsWith('#') ? input : `#${input}`)
    return emitColor({ ...parsed, a: color.value.a })
  }

  function setFormat(nextFormat: ColorFieldFormat) {
    if (format.value === nextFormat) return
    localFormat.value = nextFormat
    options.onFormatChange?.(nextFormat)
  }

  function updateFromReka(nextColor: RekaColorValue) {
    return emitColor(rekaToSceneColor(nextColor))
  }

  function updateHue(hue: number) {
    return emitColor(withHue(value.value, hue))
  }

  function updateAlpha(alpha: number) {
    return emitColor(withAlpha(color.value, alpha))
  }

  function updateRGBChannel(channel: RGBChannel, channelValue: number) {
    return emitColor(withRGBChannel(color.value, channel, channelValue))
  }

  function updateHSLChannel(channel: HSLChannel, channelValue: number) {
    return emitColor(withHSLChannel(value.value, channel, channelValue))
  }

  function updateHSBChannel(channel: HSBChannel, channelValue: number) {
    return emitColor(withHSBChannel(value.value, channel, channelValue))
  }

  function updateOkHCLChannel(channel: OkHCLChannel, channelValue: number) {
    const patch = normalizeOkHCLPatch(channel, channelValue)
    if (!okhclPatchChangesColor(value.value.okhcl, patch)) return value.value.okhcl

    if (options.onUpdateOkHCL) {
      options.onUpdateOkHCL(patch)
      return applyOkHCLPatch(value.value.okhcl, patch)
    }

    const next = applyOkHCLPatch(value.value.okhcl, patch)
    emitColor(okhclToRGBA(next))
    return next
  }

  return {
    color,
    format,
    hex,
    rekaColor: computed(() => value.value.rekaColor),
    rgb: computed(() => value.value.rgb),
    hsl: computed(() => value.value.hsl),
    hsb: computed(() => value.value.hsb),
    okhcl: computed(() => value.value.okhcl),
    sliderPreview,
    sliderGradient,
    okhclSliderPreview,
    okhclSliderGradient,
    setFormat,
    updateColor: emitColor,
    updateHex,
    updateFromReka,
    updateHue,
    updateAlpha,
    updateRGBChannel,
    updateHSLChannel,
    updateHSBChannel,
    updateOkHCLChannel
  }
}
