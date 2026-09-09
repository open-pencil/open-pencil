<script setup lang="ts">
import { computed } from 'vue'

import type { Tool } from '@open-pencil/core/editor'

import { useToolbar } from '#vue/primitives/Toolbar/context'

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
