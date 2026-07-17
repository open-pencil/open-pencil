<script setup lang="ts">
import { tv } from 'tailwind-variants'

import toolbarTheme from '@/theme/toolbar'
import { vTestId } from '@open-pencil/vue'

import type { ToolbarActionItem, ToolbarUI } from '@/components/Toolbar/types'

const { actions, testPrefix, ui } = defineProps<{
  actions: ToolbarActionItem[]
  testPrefix: string
  ui?: ToolbarUI
}>()

const styles = tv(toolbarTheme)()

const emit = defineEmits<{
  action: [item: ToolbarActionItem]
}>()
</script>

<template>
  <button
    v-for="item in actions"
    :key="item.label"
    v-test-id="`${testPrefix}-${item.label.toLowerCase()}`"
    :class="styles.action({ class: ui?.action })"
    @click="emit('action', item)"
  >
    <component :is="item.icon" :class="styles.actionIcon({ class: ui?.actionIcon })" />
  </button>
</template>
