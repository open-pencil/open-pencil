<script setup lang="ts">
import { computed } from 'vue'

import type { Effect } from '@open-pencil/scene-graph'
import { UNSET_NOISE } from '@open-pencil/scene-graph/constants'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { grainSizeChange, noiseTypeChange, type NoiseType } from '@open-pencil/vue/controls/effects'
import { useI18n } from '@open-pencil/vue/i18n'

import ColorPicker from '@/components/ColorPicker/ColorPicker.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import PaintField from '@/components/inputs/PaintField.vue'
import PaintValue from '@/components/properties/paint/PaintValue.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

/** A noise effect's settings as Figma's panel lays them out: type, grain size, density, colours. */
const { effect } = defineProps<{ effect: Effect }>()
const emit = defineEmits<{
  scrub: [changes: Partial<Effect>]
  commit: [changes: Partial<Effect>]
  patch: [changes: Partial<Effect>]
}>()

const { panels } = useI18n()
const noise = computed(() => effect.noise ?? UNSET_NOISE)
const typeOptions = computed(() => [
  { value: 'MONOTONE', label: panels.value.noiseMono },
  { value: 'DUOTONE', label: panels.value.noiseDuo },
  { value: 'MULTITONE', label: panels.value.noiseMulti }
])

/** `density` as a percentage field shows it. */
const densityPercent = computed(() => Math.round(noise.value.density * 100))

function densityChange(percent: number): Partial<Effect> {
  return { noise: { ...noise.value, density: Math.max(0, Math.min(1, percent / 100)) } }
}

function opacityChange(percent: number): Partial<Effect> {
  return { noise: { ...noise.value, opacity: Math.max(0, Math.min(1, percent / 100)) } }
}

function secondaryChange(color: Color): Partial<Effect> {
  return { noise: { ...noise.value, secondaryColor: color } }
}
</script>

<template>
  <SegmentedControl
    :model-value="noise.noiseType"
    :options="typeOptions"
    :label="panels.noiseType"
    data-property="noise-type"
    @change="emit('commit', noiseTypeChange(effect, $event as NoiseType))"
  />
  <PanelFieldGroup :label="panels.noiseSize">
    <NumberField
      icon="X"
      :inherit-binding="false"
      :aria-label="panels.noiseSize"
      :model-value="noise.noiseSize.x"
      :min="0"
      :max="100"
      data-property="noise-size"
      @update:model-value="emit('scrub', grainSizeChange(effect, $event))"
      @commit="emit('commit', grainSizeChange(effect, $event))"
    />
    <!-- As in Figma, the grain stays square: the vertical size follows the horizontal one. -->
    <NumberField
      icon="Y"
      :inherit-binding="false"
      :aria-label="panels.noiseSize"
      :model-value="noise.noiseSize.y"
      disabled
    />
  </PanelFieldGroup>
  <PanelFieldGroup :label="panels.density">
    <NumberField
      suffix="%"
      :inherit-binding="false"
      :aria-label="panels.density"
      :model-value="densityPercent"
      :min="0"
      :max="100"
      data-property="noise-density"
      @update:model-value="emit('scrub', densityChange($event))"
      @commit="emit('commit', densityChange($event))"
    >
      <template #icon><icon-lucide-grip class="size-3" /></template>
    </NumberField>
  </PanelFieldGroup>
  <PanelFieldGroup v-if="noise.noiseType === 'MULTITONE'" :label="panels.opacity">
    <NumberField
      suffix="%"
      :inherit-binding="false"
      :aria-label="panels.opacity"
      :model-value="Math.round((noise.opacity ?? 1) * 100)"
      :min="0"
      :max="100"
      data-property="noise-opacity"
      @update:model-value="emit('scrub', opacityChange($event))"
      @commit="emit('commit', opacityChange($event))"
    />
  </PanelFieldGroup>
  <PanelFieldGroup
    v-else
    :label="noise.noiseType === 'DUOTONE' ? panels.noiseColors : panels.effectColor"
  >
    <PaintField
      class="w-full flex-none"
      data-property="noise-color"
      :opacity="effect.color.a"
      :opacity-label="panels.opacity"
      @update:opacity="emit('patch', { color: { ...effect.color, a: $event } })"
    >
      <template #preview>
        <ColorPicker :color="effect.color" @update="emit('patch', { color: $event })" />
      </template>
      <template #value>
        <PaintValue
          :color="effect.color"
          :label="panels.effectColor"
          @update="emit('patch', { color: $event })"
        />
      </template>
    </PaintField>
    <PaintField
      v-if="noise.noiseType === 'DUOTONE' && noise.secondaryColor"
      class="w-full flex-none"
      data-property="noise-second-color"
      :opacity="noise.secondaryColor.a"
      :opacity-label="panels.opacity"
      @update:opacity="
        emit('patch', secondaryChange({ ...(noise.secondaryColor ?? effect.color), a: $event }))
      "
    >
      <template #preview>
        <ColorPicker
          :color="noise.secondaryColor"
          @update="emit('patch', secondaryChange($event))"
        />
      </template>
      <template #value>
        <PaintValue
          :color="noise.secondaryColor"
          :label="panels.noiseSecondColor"
          @update="emit('patch', secondaryChange($event))"
        />
      </template>
    </PaintField>
  </PanelFieldGroup>
</template>
