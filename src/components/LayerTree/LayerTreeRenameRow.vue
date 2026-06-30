<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'
import { nodeIcon } from '@/app/editor/icons'
import LayerTreeDisclosure from './LayerTreeDisclosure.vue'

import type { LayerNode } from '@open-pencil/vue'
import type { LayerRenameControls, LayerTreeItemActions } from './types'

const { renameControls } = defineProps<{
  node: LayerNode
  hasChildren: boolean
  padLeft: string
  expanded: boolean
  actions: LayerTreeItemActions
  renameControls: LayerRenameControls
}>()

const renameInput = useTemplateRef<HTMLInputElement>('renameInput')

watch(renameInput, (input) => {
  if (input) void renameControls.focusInput(input)
})
</script>

<template>
  <div class="flex w-full items-center gap-1 py-1" :style="{ paddingLeft: padLeft }">
    <LayerTreeDisclosure
      :expanded="expanded"
      :visible="hasChildren"
      @toggle="actions.toggleExpand"
    />
    <component :is="nodeIcon(node)" class="size-3 shrink-0 opacity-70" />
    <input
      ref="renameInput"
      data-layer-edit
      data-test-id="layers-item-input"
      class="min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0 text-xs text-surface outline-none"
      :value="node.name"
      @blur="renameControls.commit(node.id, $event)"
      @keydown.stop="renameControls.onKeydown"
    />
  </div>
</template>
