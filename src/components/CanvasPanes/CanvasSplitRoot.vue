<script setup lang="ts">
import { computed, watchEffect } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import CanvasSplitNode from '@/components/CanvasPanes/CanvasSplitNode.vue'

const { singlePaneOnly = false } = defineProps<{
  singlePaneOnly?: boolean
}>()

const store = useEditorStore()
const splitTree = computed(() => store.splitTree.value)

watchEffect(() => {
  if (singlePaneOnly && store.visiblePaneCount.value > 1) store.ensureSinglePane()
})
</script>

<template>
  <div class="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
    <CanvasSplitNode :node="splitTree" />
  </div>
</template>
