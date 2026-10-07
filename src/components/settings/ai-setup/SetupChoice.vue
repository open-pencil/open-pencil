<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/settings/ai-setup/flow'

const { label, description } = defineProps<{ label: string; description?: string }>()
const styles = tv(theme)()
</script>

<template>
  <label :class="styles.choice()">
    <slot />
    <slot name="icon" />
    <span
      ><span class="font-medium">{{ label }}</span
      ><span v-if="description" class="mt-1 block text-muted">{{ description }}</span></span
    >
  </label>
</template>
