<script setup lang="ts">
import { ToolbarButton } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'
import type { Component } from 'vue'

import type { ToolbarUI } from '@/components/Toolbar/types'
import toolbarTheme from '@/theme/toolbar'

interface ToolButtonProps {
  icon: Component
  label: string
  active?: boolean
  mobile?: boolean
  ui?: ToolbarUI
}

const { icon, label, active = false, mobile = false, ui } = defineProps<ToolButtonProps>()
const toolbar = tv(toolbarTheme)
const styles = computed(() => toolbar({ active, mobile }))

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <ToolbarButton
    :aria-pressed="active"
    :data-active="active || undefined"
    :data-mobile="mobile || undefined"
    :aria-label="label"
    :class="styles.button({ class: ui?.button })"
    @click="emit('click')"
  >
    <component :is="icon" :class="styles.icon({ class: ui?.icon })" />
  </ToolbarButton>
</template>
