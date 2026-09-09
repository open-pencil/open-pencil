<script setup lang="ts">
import { computed, normalizeClass, useAttrs } from 'vue'

import { actionRow } from '@/theme/list/action-row'

const { disabled, ui } = defineProps<{
  disabled?: boolean
  ui?: {
    root?: string
    leading?: string
    body?: string
    label?: string
    description?: string
    trailing?: string
  }
}>()
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const forwardedAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})
const styles = actionRow()
</script>

<template>
  <button
    v-bind="forwardedAttrs"
    type="button"
    :disabled="disabled"
    data-slot="action-row"
    :class="styles.root({ class: [ui?.root, normalizeClass(attrs.class)] })"
  >
    <span v-if="$slots.leading" data-slot="leading" :class="styles.leading({ class: ui?.leading })"
      ><slot name="leading"
    /></span>
    <span data-slot="body" :class="styles.body({ class: ui?.body })">
      <span data-slot="label" :class="styles.label({ class: ui?.label })"><slot /></span>
      <span
        v-if="$slots.description"
        data-slot="description"
        :class="styles.description({ class: ui?.description })"
        ><slot name="description"
      /></span>
    </span>
    <span
      v-if="$slots.trailing"
      data-slot="trailing"
      :class="styles.trailing({ class: ui?.trailing })"
      ><slot name="trailing"
    /></span>
  </button>
</template>
