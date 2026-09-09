<script setup lang="ts">
import { TabsList } from 'reka-ui'
import { normalizeClass, type HTMLAttributes } from 'vue'

import { tabs } from '@/theme/tabs/tabs'

const {
  label,
  class: className,
  ui
} = defineProps<{ label: string; class?: HTMLAttributes['class']; ui?: { list?: string } }>()
const styles = tabs()
</script>

<template>
  <TabsList
    :aria-label="label"
    data-slot="list"
    :class="styles.list({ class: [ui?.list, normalizeClass(className)] })"
  >
    <slot />
  </TabsList>
</template>
