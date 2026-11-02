import { computed, inject, provide, proxyRefs } from 'vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'

import type { Color } from '@open-pencil/scene-graph/primitives'
import { useColorModel, type OkHCLControls } from '@open-pencil/vue/controls/color-model'
import { useI18n } from '@open-pencil/vue/i18n'

interface ColorPanelProps {
  color: Color
  okhcl?: OkHCLControls | null
}

type ColorPanelEmit = (event: 'update', color: Color) => void

function createColorPickerPanelContext(props: ColorPanelProps, emit: ColorPanelEmit) {
  const { panels } = useI18n()
  const color = computed(() => props.color)
  const okhcl = computed(() => props.okhcl ?? null)
  const colorModel = useColorModel({
    color,
    okhcl: () => okhcl.value?.okhcl,
    format: () => okhcl.value?.fieldFormat,
    onUpdate: (nextColor) => emit('update', nextColor),
    onUpdateOkHCL: (patch) => okhcl.value?.updateOkHCL(patch),
    onFormatChange: (format) => okhcl.value?.setFieldFormat(format)
  })
  const fieldOptions = computed(
    () =>
      okhcl.value?.fieldOptions ?? [
        { value: 'rgb', label: panels.value.colorFormatRgb },
        { value: 'hsl', label: panels.value.colorFormatHsl },
        { value: 'hsb', label: panels.value.colorFormatHsb }
      ]
  )
  const isOkHCLFormat = computed(() => colorModel.format.value === 'okhcl' && okhcl.value)

  function setFieldFormat(value: string) {
    colorModel.setFormat(value)
  }

  return {
    panels,
    color,
    okhcl,
    rekaColor: colorModel.rekaColor,
    hslColor: colorModel.hsl,
    hsbColor: colorModel.hsb,
    rgbColor: colorModel.rgb,
    sliderPreview: colorModel.sliderPreview,
    sliderGradient: colorModel.sliderGradient,
    okhclSliderPreview: colorModel.okhclSliderPreview,
    okhclSliderGradient: colorModel.okhclSliderGradient,
    fieldOptions,
    fieldFormat: colorModel.format,
    isOkHCLFormat,
    onRekaColorUpdate: colorModel.updateFromReka,
    setFieldFormat,
    updateRGBAHue: colorModel.updateHue,
    updateRGBAAlpha: colorModel.updateAlpha,
    updateRGBChannelValue: colorModel.updateRGBChannel,
    updateHSLChannelValue: colorModel.updateHSLChannel,
    updateHSBChannelValue: colorModel.updateHSBChannel,
    updateOkHCLChannel: colorModel.updateOkHCLChannel
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
