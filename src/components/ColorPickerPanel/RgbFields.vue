<script setup lang="ts">
import { useColorPickerPanelContext } from '@/components/ColorPickerPanel/context'

const ctx = useColorPickerPanelContext()
</script>

<template>
  <div
    class="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-px overflow-hidden rounded border border-border bg-border"
  >
    <input
      type="number"
      class="bg-input px-2 py-1 text-xs text-surface outline-none"
      :value="Math.round(ctx.rgbColor.r)"
      min="0"
      max="255"
      @change="ctx.updateRGBChannelValue('r', +($event.target as HTMLInputElement).value)"
    />
    <input
      type="number"
      class="bg-input px-2 py-1 text-xs text-surface outline-none"
      :value="Math.round(ctx.rgbColor.g)"
      min="0"
      max="255"
      @change="ctx.updateRGBChannelValue('g', +($event.target as HTMLInputElement).value)"
    />
    <input
      type="number"
      class="bg-input px-2 py-1 text-xs text-surface outline-none"
      :value="Math.round(ctx.rgbColor.b)"
      min="0"
      max="255"
      @change="ctx.updateRGBChannelValue('b', +($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
