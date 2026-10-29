<script setup lang="ts">
import { SelectRoot, SelectTrigger } from 'reka-ui'
import { computed } from 'vue'

import type { SceneNode, TextLength } from '@open-pencil/scene-graph'
import { pixelLength } from '@open-pencil/scene-graph/text'
import { useEditor } from '@open-pencil/vue'
import { useI18n } from '@open-pencil/vue/i18n'
import { useRetainedPopup } from '@open-pencil/vue/lifecycle/retention'

import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import AppSelectContent from '@/components/ui/select/AppSelectContent.vue'
import AppSelectItem from '@/components/ui/select/AppSelectItem.vue'

import { useTextLength } from './useTextLength'

/** Every selected text layer; the field reads Mixed when their line heights differ. */
const { nodes } = defineProps<{ nodes: readonly SceneNode[] }>()
const emit = defineEmits<{
  update: [value: TextLength]
  commit: [value: TextLength, previous: TextLength]
}>()
const editor = useEditor()
const { open: popupOpen, portalActive } = useRetainedPopup()
const { panels } = useI18n()
const isAutomatic = (node: SceneNode) => node.lineHeight == null && !node.boundVariables.lineHeight
/** The pixels an automatic line height becomes when it is fixed. */
const automaticPixels = (node: SceneNode) => Math.round((node.fontSize || 14) * 1.2)
const automatic = computed(() => nodes.length > 0 && nodes.every(isAutomatic))
const { value, suffix, length } = useTextLength(() => nodes, 'lineHeight', automaticPixels)
const nodeId = computed(() => nodes.at(0)?.id ?? '')
const nodeIds = computed(() => nodes.map((node) => node.id))
function setMode(mode: string) {
  if (mode === 'AUTO') {
    editor.undo.runBatch('Use automatic line height', () => {
      for (const node of nodes) {
        if (node.boundVariables.lineHeight) editor.unbindVariable(node.id, 'lineHeight')
        editor.updateNodeWithUndo(node.id, { lineHeight: null }, 'Use automatic line height')
      }
    })
  } else if (mode === 'FIXED') {
    editor.undo.runBatch('Set line height', () => {
      for (const node of nodes.filter(isAutomatic))
        editor.updateNodeWithUndo(
          node.id,
          { lineHeight: pixelLength(automaticPixels(node)) },
          'Set line height'
        )
    })
  }
}
</script>

<template>
  <VariableNumberField
    :model-value="value"
    :aria-label="panels.lineHeight"
    :suffix="suffix"
    :min="0"
    :node-id="nodeId"
    :node-ids="nodeIds"
    binding-path="lineHeight"
    @update:model-value="emit('update', length($event))"
    @commit="(current, previous) => emit('commit', length(current), length(previous))"
  >
    <template #icon><icon-lucide-baseline class="size-3" /></template>
    <template v-if="automatic" #display
      ><span class="min-w-0 flex-1 truncate text-surface">{{ panels.auto }}</span></template
    >
    <template #after-variable>
      <SelectRoot
        v-model:open="popupOpen"
        :model-value="automatic ? 'AUTO' : 'FIXED'"
        @update:model-value="setMode"
      >
        <SelectTrigger
          :aria-label="panels.lineHeightMode"
          class="flex shrink-0 items-center self-stretch px-1 text-muted"
          @pointerdown.stop
          @keydown.stop
          ><icon-lucide-chevron-down class="size-3"
        /></SelectTrigger>
        <AppSelectContent v-if="portalActive" align="end">
          <AppSelectItem value="AUTO">{{ panels.auto }}</AppSelectItem>
          <AppSelectItem value="FIXED">{{ panels.sizingFixed }}</AppSelectItem>
        </AppSelectContent>
      </SelectRoot>
    </template>
  </VariableNumberField>
</template>
