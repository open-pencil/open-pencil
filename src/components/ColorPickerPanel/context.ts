import { computed, inject, provide, proxyRefs } from 'vue'

import {
  createColorPickerModel,
  createOkHCLSliderGradientModel,
  createOkHCLSliderPreviewModel,
  createSliderGradientModel,
  createSliderPreviewModel,
  rekaToAppColor,
  updateAlpha,
  updateHSBChannel,
  updateHSLChannel,
  updateHue,
  updateRGBChannel,
  useI18n
} from '@open-pencil/vue'

import type { Color } from '@open-pencil/core/types'
import type { OkHCLControls } from '@open-pencil/vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'

type ColorPanelProps = {
  color: Color
  okhcl?: OkHCLControls | null
}

type ColorPanelEmit = (event: 'update', color: Color) => void

type RekaColor = ReturnType<typeof createColorPickerModel>['rekaColor']

function createColorPickerPanelContext(props: ColorPanelProps, emit: ColorPanelEmit) {
  const { panels } = useI18n()
  const color = computed(() => props.color)
  const okhcl = computed(() => props.okhcl ?? null)
  const pickerModel = computed(() => createColorPickerModel(color.value))
  const rekaColor = computed(() => pickerModel.value.rekaColor)
  const hslColor = computed(() => pickerModel.value.hsl)
  const hsbColor = computed(() => pickerModel.value.hsb)
  const rgbColor = computed(() => pickerModel.value.rgb)
  const sliderPreview = computed(() => createSliderPreviewModel(pickerModel.value))
  const sliderGradient = computed(() => createSliderGradientModel(pickerModel.value))
  const okhclSliderPreview = computed(() =>
    okhcl.value?.okhcl ? createOkHCLSliderPreviewModel(okhcl.value.okhcl) : null
  )
  const okhclSliderGradient = computed(() =>
    okhcl.value?.okhcl ? createOkHCLSliderGradientModel(okhcl.value.okhcl) : null
  )
  const fieldOptions = computed(
    () =>
      okhcl.value?.fieldOptions ?? [
        { value: 'rgb', label: panels.value.colorFormatRgb },
        { value: 'hsl', label: panels.value.colorFormatHsl },
        { value: 'hsb', label: panels.value.colorFormatHsb }
      ]
  )
  const fieldFormat = computed(() => okhcl.value?.fieldFormat ?? 'rgb')
  const isOkHCLFormat = computed(() => fieldFormat.value === 'okhcl' && okhcl.value)

  function updateColor(nextColor: Color) {
    emit('update', nextColor)
  }

  function onRekaColorUpdate(colorValue: RekaColor) {
    updateColor(rekaToAppColor(colorValue))
  }

  function setFieldFormat(value: string) {
    okhcl.value?.setFieldFormat(value as NonNullable<OkHCLControls>['fieldFormat'])
  }

  function updateRGBAHue(value: number) {
    updateColor(updateHue(pickerModel.value, value))
  }

  function updateRGBAAlpha(value: number) {
    updateColor(updateAlpha(color.value, value))
  }

  function updateRGBChannelValue(channel: 'r' | 'g' | 'b', value: number) {
    updateColor(updateRGBChannel(color.value, channel, value))
  }

  function updateHSLChannelValue(channel: 'h' | 's' | 'l', value: number) {
    updateColor(updateHSLChannel(pickerModel.value, channel, value))
  }

  function updateHSBChannelValue(channel: 'h' | 's' | 'b', value: number) {
    updateColor(updateHSBChannel(pickerModel.value, channel, value))
  }

  function updateOkHCLChannel(channel: 'h' | 'c' | 'l' | 'a', value: number) {
    okhcl.value?.updateOkHCL({ [channel]: value })
  }

  return {
    panels,
    color,
    okhcl,
    pickerModel,
    rekaColor,
    hslColor,
    hsbColor,
    rgbColor,
    sliderPreview,
    sliderGradient,
    okhclSliderPreview,
    okhclSliderGradient,
    fieldOptions,
    fieldFormat,
    isOkHCLFormat,
    onRekaColorUpdate,
    setFieldFormat,
    updateRGBAHue,
    updateRGBAAlpha,
    updateRGBChannelValue,
    updateHSLChannelValue,
    updateHSBChannelValue,
    updateOkHCLChannel
  }
}

export type ColorPickerPanelContext = ShallowUnwrapRef<
  ReturnType<typeof createColorPickerPanelContext>
>

const COLOR_PICKER_PANEL_KEY: InjectionKey<ColorPickerPanelContext> =
  Symbol('ColorPickerPanelContext')

export function provideColorPickerPanel(props: ColorPanelProps, emit: ColorPanelEmit) {
  provide(COLOR_PICKER_PANEL_KEY, proxyRefs(createColorPickerPanelContext(props, emit)))
}

export function useColorPickerPanelContext(): ColorPickerPanelContext {
  const ctx = inject(COLOR_PICKER_PANEL_KEY)
  if (!ctx) throw new Error('Color picker panel controls must be used within ColorPickerPanel')
  return ctx
}
