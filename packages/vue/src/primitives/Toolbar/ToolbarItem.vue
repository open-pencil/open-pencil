<script setup lang="ts">
import { computed } from 'vue'

import { useToolbar } from '#vue/primitives/Toolbar/context'

import type { Tool } from '@open-pencil/core/editor'

const { tool } = defineProps<{
  tool: Tool
}>()

const { activeTool, setTool } = useToolbar()

const isActive = computed(() => activeTool.value === tool)
const actions = {
  select: () => setTool(tool)
}
</script>

<template>
  <slot :active="isActive" :actions="actions" :tool="tool" />
</template>
