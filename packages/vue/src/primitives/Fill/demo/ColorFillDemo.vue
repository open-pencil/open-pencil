<script setup lang="ts">
import { ref } from 'vue'

import type { Fill, Variable } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { BindingProvider, BindingTarget } from '#vue/controls/binding-provider/types'
import BindableValueRoot from '#vue/primitives/BindableValue/BindableValueRoot.vue'
import ChannelSliderRoot from '#vue/primitives/ChannelSlider/ChannelSliderRoot.vue'
import ChannelSliderThumb from '#vue/primitives/ChannelSlider/ChannelSliderThumb.vue'
import ChannelSliderTrack from '#vue/primitives/ChannelSlider/ChannelSliderTrack.vue'
import FillRoot from '#vue/primitives/Fill/FillRoot.vue'
import FillSwatch from '#vue/primitives/Fill/FillSwatch.vue'

const solid: Fill = {
  type: 'SOLID',
  color: { r: 0.22, g: 0.48, b: 0.96, a: 1 },
  opacity: 1,
  visible: true
}
const transparent: Fill = {
  ...solid,
  color: { ...solid.color, a: 0.45 }
}
const gradient: Fill = {
  ...solid,
  type: 'GRADIENT_LINEAR',
  gradientStops: [
    { color: { r: 0.55, g: 0.24, b: 0.98, a: 1 }, position: 0 },
    { color: { r: 0.08, g: 0.72, b: 0.65, a: 0.65 }, position: 1 }
  ]
}
const editableFill = ref<Fill>(structuredClone(solid))
const chroma = ref(0.16)
const target: BindingTarget[] = [{ nodeId: 'demo', path: 'fills/0/color' }]
const variable: Variable = {
  id: 'color/brand',
  name: 'Color/Brand',
  type: 'COLOR',
  collectionId: 'demo',
  valuesByMode: { default: { r: 0.65, g: 0.3, b: 0.95, a: 1 } },
  description: '',
  hiddenFromPublishing: false
}
const boundColor: Color = { r: 0.65, g: 0.3, b: 0.95, a: 1 }
const provider: BindingProvider<Color> = {
  listVariables: () => [variable],
  filterVariables: () => [variable],
  getBindingId: () => variable.id,
  getBound: () => variable,
  getState: () => 'bound',
  resolve: (variableId) => (variableId === variable.id ? boundColor : undefined),
  bind: () => undefined,
  unbind: () => undefined
}
</script>

<template>
  <div
    class="w-full max-w-[560px] space-y-5 rounded-lg border border-[var(--vp-c-divider)] bg-[var(--vp-c-bg-soft)] p-5 text-[var(--vp-c-text-1)]"
  >
    <section>
      <h3 class="mb-2 text-sm font-semibold">Fill swatches</h3>
      <div class="flex flex-wrap gap-4">
        <FillSwatch
          v-for="(item, name) in { Solid: solid, Transparent: transparent, Gradient: gradient }"
          :key="name"
          v-slot="swatch"
          :fill="item"
          :label="`${name} fill`"
          class="relative size-10 overflow-hidden rounded-md border border-[var(--vp-c-divider)] bg-[conic-gradient(#ddd_25%,#fff_0_50%,#ddd_0_75%,#fff_0)] bg-[size:10px_10px]"
        >
          <span class="absolute inset-0" :style="{ background: swatch.background }" />
        </FillSwatch>
        <BindableValueRoot :provider="provider" :targets="target" :value="solid.color">
          <FillSwatch
            v-slot="swatch"
            :fill="solid"
            label="Bound token fill"
            class="relative size-10 overflow-hidden rounded-md border border-[var(--vp-c-divider)]"
          >
            <span class="absolute inset-0" :style="{ background: swatch.background }" />
          </FillSwatch>
        </BindableValueRoot>
      </div>
    </section>

    <section>
      <h3 class="mb-2 text-sm font-semibold">Fill state</h3>
      <FillRoot v-slot="fillModel" :fill="editableFill" @update="editableFill = $event">
        <div class="flex items-center gap-2">
          <FillSwatch
            v-slot="swatch"
            :fill="editableFill"
            label="Editable fill"
            class="relative size-8 overflow-hidden rounded border border-[var(--vp-c-divider)]"
          >
            <span class="absolute inset-0" :style="{ background: swatch.background }" />
          </FillSwatch>
          <button class="rounded border px-2 py-1 text-xs" @click="fillModel.actions.toSolid">
            Solid
          </button>
          <button class="rounded border px-2 py-1 text-xs" @click="fillModel.actions.toGradient">
            Gradient
          </button>
          <button class="rounded border px-2 py-1 text-xs" @click="fillModel.actions.toImage">
            Image
          </button>
        </div>
      </FillRoot>
    </section>

    <section>
      <h3 class="mb-2 text-sm font-semibold">OkHCL channel</h3>
      <ChannelSliderRoot
        v-model="chroma"
        v-slot="slider"
        label="Chroma"
        :min="0"
        :max="0.4"
        :step="0.001"
        :format-value-text="(value) => `${Math.round(value * 100)}%`"
        class="relative flex h-4 touch-none items-center"
      >
        <ChannelSliderTrack
          class="absolute h-3 w-full rounded bg-[linear-gradient(to_right,#ddd,#7c3aed)]"
        />
        <ChannelSliderThumb
          class="block size-4 rounded-full border-2 border-white bg-violet-600 shadow outline-none focus-visible:ring-2"
        />
        <output class="ml-auto pl-4 text-xs tabular-nums"
          >{{ Math.round(slider.value * 100) }}%</output
        >
      </ChannelSliderRoot>
    </section>
  </div>
</template>
