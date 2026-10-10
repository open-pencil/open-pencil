<script setup lang="ts">
import {
  SelectRoot,
  SelectTrigger,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText
} from 'reka-ui'
import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import { MIXED, useEditor, useI18n, useRetainedPopup } from '@open-pencil/vue'

import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import { useSelectUI } from '@/components/ui/select/select'

/** Every selected text layer; the field reads Mixed when their line heights differ. */
const { nodes } = defineProps<{ nodes: readonly SceneNode[] }>()
const emit = defineEmits<{ update: [value: number]; commit: [value: number, previous: number] }>()
const editor = useEditor()
const { open: popupOpen, portalActive } = useRetainedPopup()
const { panels } = useI18n()
const isAutomatic = (node: SceneNode) => node.lineHeight == null && !node.boundVariables.lineHeight
const fixedValue = (node: SceneNode) => node.lineHeight ?? Math.round((node.fontSize || 14) * 1.2)
const automatic = computed(() => nodes.length > 0 && nodes.every(isAutomatic))
const value = computed(() => {
  const values = nodes.map(fixedValue)
  const [first = 0] = values
  return values.every((current) => current === first) ? first : MIXED
})
const nodeId = computed(() => nodes.at(0)?.id ?? '')
const nodeIds = computed(() => nodes.map((node) => node.id))
const menu = useSelectUI()
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
        editor.updateNodeWithUndo(node.id, { lineHeight: fixedValue(node) }, 'Set line height')
    })
  }
}
</script>

<template>
  <VariableNumberField
    :model-value="value"
    :aria-label="panels.lineHeight"
    suffix="px"
    :min="0"
    :node-id="nodeId"
    :node-ids="nodeIds"
    binding-path="lineHeight"
    @update:model-value="emit('update', $event)"
    @commit="(current, previous) => emit('commit', current, previous)"
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
          ><icon-lucide-chevron-down class="size-3"
        /></SelectTrigger>
        <SelectPortal v-if="portalActive">
          <SelectContent position="popper" :side-offset="4" :class="menu.content">
            <SelectViewport>
              <SelectItem value="AUTO" :class="menu.item"
                ><SelectItemText>{{ panels.auto }}</SelectItemText></SelectItem
              >
              <SelectItem value="FIXED" :class="menu.item"
                ><SelectItemText>{{ panels.sizingFixed }}</SelectItemText></SelectItem
              >
            </SelectViewport>
          </SelectContent>
        </SelectPortal>
      </SelectRoot>
    </template>
  </VariableNumberField>
</template>
