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
import { useEditor, useI18n } from '@open-pencil/vue'

import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import { useSelectUI } from '@/components/ui/select/select'

const { node } = defineProps<{ node: SceneNode }>()
const emit = defineEmits<{ update: [value: number]; commit: [value: number, previous: number] }>()
const editor = useEditor()
const { panels } = useI18n()
const automatic = computed(() => node.lineHeight == null && !node.boundVariables.lineHeight)
const value = computed(() => node.lineHeight ?? Math.round((node.fontSize || 14) * 1.2))
const menu = useSelectUI()
function setMode(mode: string) {
  if (mode === 'AUTO') {
    editor.undo.runBatch('Use automatic line height', () => {
      if (node.boundVariables.lineHeight) editor.unbindVariable(node.id, 'lineHeight')
      editor.updateNodeWithUndo(node.id, { lineHeight: null }, 'Use automatic line height')
    })
  } else if (mode === 'FIXED' && automatic.value) {
    editor.updateNodeWithUndo(node.id, { lineHeight: value.value }, 'Set line height')
  }
}
</script>

<template>
  <VariableNumberField
    :model-value="value"
    :aria-label="panels.lineHeight"
    suffix="px"
    :min="0"
    :node-id="node.id"
    binding-path="lineHeight"
    @update:model-value="emit('update', $event)"
    @commit="(current, previous) => emit('commit', current, previous)"
  >
    <template #icon><icon-lucide-baseline class="size-3" /></template>
    <template v-if="automatic" #display
      ><span class="min-w-0 flex-1 truncate text-surface">{{ panels.auto }}</span></template
    >
    <template #after-variable>
      <SelectRoot :model-value="automatic ? 'AUTO' : 'FIXED'" @update:model-value="setMode">
        <SelectTrigger
          :aria-label="panels.lineHeightMode"
          class="flex shrink-0 items-center self-stretch px-1 text-muted"
          @pointerdown.stop
          ><icon-lucide-chevron-down class="size-3"
        /></SelectTrigger>
        <SelectPortal>
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
