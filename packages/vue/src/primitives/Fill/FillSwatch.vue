<script setup lang="ts">
import { Primitive } from 'reka-ui'
import { computed } from 'vue'

import type { Color } from '@open-pencil/scene-graph/primitives'

import { useOptionalBindableValue } from '#vue/primitives/BindableValue/context'

import type { FillSwatchProps, FillSwatchSlots } from './types'
import { fillCategory, fillIsTransparent, fillSwatchBackground } from './useFill'

const { fill, label, as = 'span', asChild = false } = defineProps<FillSwatchProps>()
defineSlots<FillSwatchSlots>()
defineOptions({ inheritAttrs: false })

const binding = useOptionalBindableValue<Color>()
const bindingState = computed(() => binding?.state.value)
const boundColor = computed(() =>
  bindingState.value === 'bound' ? binding?.resolvedValue.value : undefined
)
const effectiveFill = computed(() =>
  fill.type === 'SOLID' && boundColor.value ? { ...fill, color: boundColor.value } : fill
)
const category = computed(() => fillCategory(effectiveFill.value))
const background = computed(() => fillSwatchBackground(effectiveFill.value))
const transparent = computed(() => fillIsTransparent(effectiveFill.value))
const accessibleLabel = computed(() => label ?? `${category.value.toLowerCase()} fill`)
const stateAttrs = computed(() => binding?.stateAttrs.value)
const slotProps = computed(() => ({
  fill: effectiveFill.value,
  color: effectiveFill.value.color,
  category: category.value,
  background: background.value,
  transparent: transparent.value,
  bindingState: bindingState.value,
  stateAttrs: stateAttrs.value
}))
</script>

<template>
  <Primitive
    v-bind="{ ...$attrs, ...stateAttrs }"
    :as="as"
    :as-child="asChild"
    :aria-label="accessibleLabel"
    :data-fill-type="effectiveFill.type"
    :data-fill-category="category"
    :data-transparent="transparent ? '' : undefined"
    :style="{ '--open-pencil-fill-swatch-background': background }"
    role="img"
    aria-roledescription="fill swatch"
    data-slot="swatch"
  >
    <slot v-bind="slotProps" />
  </Primitive>
</template>
