<script setup lang="ts">
import { computed } from 'vue'

import type { Effect } from '@open-pencil/scene-graph'
import { UNSET_TEXTURE } from '@open-pencil/scene-graph/constants'
import { grainSizeChange } from '@open-pencil/vue/controls/effects'
import { useI18n } from '@open-pencil/vue/i18n'

import NumberField from '@/components/inputs/NumberField.vue'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'

/** A texture effect's settings as Figma's panel lays them out: grain size, radius, clipping. */
const { effect, index, nodeIds } = defineProps<{
  effect: Effect
  index: number
  nodeIds: readonly string[]
}>()
const emit = defineEmits<{
  scrub: [changes: Partial<Effect>]
  commit: [changes: Partial<Effect>]
}>()

const { panels } = useI18n()
const texture = computed(() => effect.texture ?? UNSET_TEXTURE)

/** Figma keeps a texture's radius within 0 to 100. */
function radiusChange(radius: number): Partial<Effect> {
  return { radius: Math.max(0, Math.min(100, radius)) }
}
</script>

<template>
  <PanelFieldGroup :label="panels.grainSize">
    <NumberField
      icon="X"
      :inherit-binding="false"
      :aria-label="panels.grainSize"
      :model-value="texture.noiseSize.x"
      :min="0"
      :max="100"
      data-property="texture-size"
      @update:model-value="emit('scrub', grainSizeChange(effect, $event))"
      @commit="emit('commit', grainSizeChange(effect, $event))"
    />
    <!-- As in Figma, the grain stays square: the vertical size follows the horizontal one. -->
    <NumberField
      icon="Y"
      :inherit-binding="false"
      :aria-label="panels.grainSize"
      :model-value="texture.noiseSize.y"
      disabled
    />
  </PanelFieldGroup>
  <PanelFieldGroup :label="panels.radius">
    <VariableNumberField
      :aria-label="panels.radius"
      :model-value="effect.radius"
      :min="0"
      :max="100"
      :node-id="nodeIds[0] ?? ''"
      :node-ids="nodeIds"
      :binding-path="`effects/${index}/radius`"
      data-property="texture-radius"
      @update:model-value="emit('scrub', radiusChange($event))"
      @commit="emit('commit', radiusChange($event))"
    >
      <template #icon><icon-lucide-sun class="size-3" /></template>
    </VariableNumberField>
  </PanelFieldGroup>
  <label class="flex cursor-pointer items-center gap-2 text-xs text-surface">
    <AppCheckbox
      :model-value="texture.clipToShape"
      :ariaLabel="panels.clipToShape"
      data-property="texture-clip"
      @update:model-value="emit('commit', { texture: { ...texture, clipToShape: $event } })"
    />
    {{ panels.clipToShape }}
  </label>
</template>
