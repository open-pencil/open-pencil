<script setup lang="ts">
import { computed } from 'vue'

import { fromPercent, toPercent } from '@open-pencil/vue/controls/color-model'
import { useMessages } from '@open-pencil/vue/i18n'

import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'
import NumberField from '@/components/inputs/NumberField.vue'

interface Channel {
  label: string
  value: number
  max: number
  set: (value: number) => void
}

const ctx = useColorPickerPanelContext()
const pickerMessages = useMessages('panels/pickers')

/** The format's three channels, which Figma lists beside the format with the alpha last. */
const channels = computed<Channel[]>(() => {
  const p = pickerMessages.value
  const okhcl = ctx.isOkHCLFormat ? ctx.okhcl?.okhcl : undefined
  if (okhcl)
    return [
      {
        label: p.hue,
        value: okhcl.h,
        max: 360,
        set: (v) => ctx.updateOkHCLChannel('h', v)
      },
      {
        label: p.chroma,
        value: toPercent(okhcl.c),
        max: 40,
        set: (v) => ctx.updateOkHCLChannel('c', fromPercent(v))
      },
      {
        label: p.lightness,
        value: toPercent(okhcl.l),
        max: 100,
        set: (v) => ctx.updateOkHCLChannel('l', fromPercent(v))
      }
    ]
  if (ctx.fieldFormat === 'hsl')
    return [
      {
        label: p.hue,
        value: ctx.hslColor.h ?? 0,
        max: 360,
        set: (v) => ctx.updateHSLChannelValue('h', v)
      },
      {
        label: p.saturation,
        value: ctx.hslColor.s ?? 0,
        max: 100,
        set: (v) => ctx.updateHSLChannelValue('s', v)
      },
      {
        label: p.lightness,
        value: ctx.hslColor.l ?? 0,
        max: 100,
        set: (v) => ctx.updateHSLChannelValue('l', v)
      }
    ]
  if (ctx.fieldFormat === 'hsb')
    return [
      {
        label: p.hue,
        value: ctx.hsbColor.h,
        max: 360,
        set: (v) => ctx.updateHSBChannelValue('h', v)
      },
      {
        label: p.saturation,
        value: ctx.hsbColor.s,
        max: 100,
        set: (v) => ctx.updateHSBChannelValue('s', v)
      },
      {
        label: p.brightness,
        value: ctx.hsbColor.b,
        max: 100,
        set: (v) => ctx.updateHSBChannelValue('b', v)
      }
    ]
  return [
    {
      label: p.red,
      value: ctx.rgbColor.r,
      max: 255,
      set: (v) => ctx.updateRGBChannelValue('r', v)
    },
    {
      label: p.green,
      value: ctx.rgbColor.g,
      max: 255,
      set: (v) => ctx.updateRGBChannelValue('g', v)
    },
    {
      label: p.blue,
      value: ctx.rgbColor.b,
      max: 255,
      set: (v) => ctx.updateRGBChannelValue('b', v)
    }
  ]
})

/** OkHCL keeps its own alpha with its other channels. */
const alpha = computed(() => {
  const okhcl = ctx.isOkHCLFormat ? ctx.okhcl?.okhcl : undefined
  if (okhcl)
    return {
      value: toPercent(okhcl.a ?? 1),
      set: (v: number) => ctx.updateOkHCLChannel('a', fromPercent(v))
    }
  return { value: ctx.color.a * 100, set: (v: number) => ctx.updateRGBAAlpha(v / 100) }
})

/** One joined group, as Figma's: inner corners square, the shared field for limits and focus. */
const field = {
  root: 'min-w-0 flex-1 rounded-none first:rounded-s last:rounded-e',
  leading: 'hidden',
  field: 'px-0.5 text-center',
  display: 'justify-center px-0.5 pe-0.5',
  suffix: 'pe-1'
}
</script>

<template>
  <div dir="ltr" class="flex min-w-0 gap-px">
    <NumberField
      v-for="channel in channels"
      :key="channel.label"
      :aria-label="channel.label"
      :model-value="Math.round(channel.value)"
      :min="0"
      :max="channel.max"
      :ui="field"
      @update:model-value="channel.set"
    />
    <NumberField
      :aria-label="pickerMessages.alpha"
      :model-value="Math.round(alpha.value)"
      :min="0"
      :max="100"
      suffix="%"
      :ui="{ ...field, root: `${field.root} flex-[1.6]` }"
      @update:model-value="alpha.set"
    />
  </div>
</template>
