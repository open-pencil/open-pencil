<script setup lang="ts">
import { Primitive } from 'reka-ui'
import { computed } from 'vue'

import type { FillSwatchProps, FillSwatchSlots } from './types'
import { fillCategory, fillIsTransparent, fillSwatchBackground } from './useFill'

const { fill, label, as = 'span', asChild = false } = defineProps<FillSwatchProps>()
defineSlots<FillSwatchSlots>()
defineOptions({ inheritAttrs: false })

const category = computed(() => fillCategory(fill))
const background = computed(() => fillSwatchBackground(fill))
const transparent = computed(() => fillIsTransparent(fill))
const slotProps = computed(() => ({
  fill,
  color: fill.color,
  category: category.value,
  background: background.value,
  transparent: transparent.value
}))
</script>

<template>
  <Primitive
    v-bind="$attrs"
    :as="as"
    :as-child="asChild"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    :data-fill-type="fill.type"
    :data-fill-category="category"
    :data-transparent="transparent ? '' : undefined"
    :style="{ '--open-pencil-fill-swatch-background': background }"
    data-slot="swatch"
  >
    <slot v-bind="slotProps" />
  </Primitive>
</template>
