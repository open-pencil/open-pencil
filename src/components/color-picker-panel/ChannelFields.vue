<script setup lang="ts">
import { computed } from 'vue'

import { fromPercent, toPercent } from '@open-pencil/vue/controls/color-model'
import { useI18n } from '@open-pencil/vue/i18n'
import { inputNumberValue } from '@open-pencil/vue/shared/dom-events'

import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'

interface Channel {
  label: string
  value: number
  max: number
  set: (value: number) => void
}

const ctx = useColorPickerPanelContext()
const { panels } = useI18n()

/** The format's three channels, which Figma lists beside the format with the alpha last. */
const channels = computed<Channel[]>(() => {
  const p = panels.value
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

const cell =
  'min-w-0 bg-input px-1 py-1 text-center text-xs text-surface outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none'
</script>

<template>
  <div
    dir="ltr"
    class="grid min-w-0 grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)] gap-px overflow-hidden rounded border border-border bg-border"
  >
    <input
      v-for="channel in channels"
      :key="channel.label"
      type="number"
      :aria-label="channel.label"
      :class="cell"
      :value="Math.round(channel.value)"
      min="0"
      :max="channel.max"
      @change="channel.set(inputNumberValue($event))"
    />
    <label class="flex min-w-0 items-center bg-input pe-1">
      <input
        type="number"
        :aria-label="panels.alpha"
        :class="[cell, 'w-full pe-0 text-end']"
        :value="Math.round(alpha.value)"
        min="0"
        max="100"
        @change="alpha.set(inputNumberValue($event))"
      />
      <span class="text-xs text-muted">%</span>
    </label>
  </div>
</template>
