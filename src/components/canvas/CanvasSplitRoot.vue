<script setup lang="ts">
import { computed } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import CanvasSplitNode from '@/components/canvas/CanvasSplitNode.vue'

const store = useEditorStore()
const splitTree = computed(() => store.splitTree.value)
</script>

<template>
  <div data-slot="canvas-split-root" class="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
    <CanvasSplitNode :node="splitTree" />
  </div>
</template>
