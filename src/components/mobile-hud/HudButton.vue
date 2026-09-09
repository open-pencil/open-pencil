<script setup lang="ts">
import { computed, normalizeClass, type HTMLAttributes } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import { hudButton } from '@/theme/mobile/hud-button'

const {
  label,
  iconOnly = false,
  disabled = false,
  class: className
} = defineProps<{
  label: string
  iconOnly?: boolean
  disabled?: boolean
  class?: HTMLAttributes['class']
}>()
defineOptions({ inheritAttrs: false })
const styles = computed(() => hudButton({ iconOnly }))
</script>

<template>
  <AppButton
    v-bind="$attrs"
    :aria-label="label"
    :disabled="disabled"
    size="md"
    shape="pill"
    :ui="{ base: styles.base({ class: normalizeClass(className) }), icon: styles.icon() }"
  >
    <template v-if="$slots.leading" #leading><slot name="leading" /></template>
    <slot>{{ label }}</slot>
  </AppButton>
</template>
