<script setup lang="ts">
import { computed } from 'vue'

import { useToolbar } from './context'

import type { Tool } from '@open-pencil/core/editor'

const { tool } = defineProps<{
  tool: Tool
}>()

const { activeTool, setTool } = useToolbar()

const isActive = computed(() => activeTool.value === tool)
</script>

<template>
  <slot
    :active="isActive"
    :select="() => setTool(tool)"
    :tool="tool"
  />
</template>
