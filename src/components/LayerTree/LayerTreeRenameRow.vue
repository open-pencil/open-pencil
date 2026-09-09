<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, useTemplateRef, watch } from 'vue'

import type { LayerNode } from '@open-pencil/vue'

import { nodeIcon } from '@/app/editor/icons'
import layerTreeTheme from '@/theme/layer-tree'

import LayerTreeDisclosure from './LayerTreeDisclosure.vue'
import type { LayerRenameControls, LayerTreeItemActions } from './types'
import { useLayerTreeUI } from './ui'

const { renameControls, expanded } = defineProps<{
  node: LayerNode
  hasChildren: boolean
  padLeft: string
  expanded: boolean
  actions: LayerTreeItemActions
  renameControls: LayerRenameControls
}>()

const renameInput = useTemplateRef<HTMLInputElement>('renameInput')
const ui = useLayerTreeUI()
const layerTree = tv(layerTreeTheme)
const styles = computed(() => layerTree({ expanded }))

watch(renameInput, (input) => {
  if (input) void renameControls.focusInput(input)
})
</script>

<template>
  <div
    data-slot="rename-row"
    :class="styles.renameRow({ class: ui?.renameRow })"
    :style="{ paddingLeft: padLeft }"
  >
    <LayerTreeDisclosure
      :expanded="expanded"
      :visible="hasChildren"
      @toggle="actions.toggleExpand"
    />
    <component
      :is="nodeIcon(node)"
      data-slot="rename-icon"
      :class="styles.renameIcon({ class: ui?.renameIcon })"
    />
    <input
      ref="renameInput"
      data-layer-edit
      data-test-id="layers-item-input"
      data-slot="rename-input"
      :class="styles.renameInput({ class: ui?.renameInput })"
      :value="node.name"
      @blur="renameControls.commit(node.id, $event)"
      @keydown.stop="renameControls.onKeydown"
    />
  </div>
</template>
