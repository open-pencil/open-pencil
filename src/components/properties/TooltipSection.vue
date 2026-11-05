<script setup lang="ts">
import { ref, watch } from 'vue'

import type { PluginDataEntry } from '@open-pencil/scene-graph'
import { useSceneComputed, useSelectionState } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const editor = useEditorStore()
const { selectedNode: node } = useSelectionState()

const PLUGIN_ID = 'minecraft'
const TOOLTIP_KEY = 'tooltip'

/** Reads the current tooltip from pluginData of the active node. */
const activeTooltip = useSceneComputed(() => {
  const current = node.value
  if (!current?.pluginData) return ''
  const entry = current.pluginData.find((e) => e.key === TOOLTIP_KEY)
  return entry?.value ?? ''
})

const draft = ref('')

watch(
  activeTooltip,
  (val) => {
    draft.value = val
  },
  { immediate: true }
)

/** Commits the draft text to the node's pluginData with undo history. */
function commitTooltip() {
  const current = node.value
  if (!current) return
  const text = draft.value.trim()
  if (text === activeTooltip.value) return

  const targetNodes = editor.getSelectedNodes()
  const targets = targetNodes.length > 0 ? targetNodes : [current]
  for (const target of targets) {
    const clean = (target.pluginData ?? []).filter((e) => e.key !== TOOLTIP_KEY)
    const nextPluginData: PluginDataEntry[] = text
      ? [...clean, { pluginId: PLUGIN_ID, key: TOOLTIP_KEY, value: text }]
      : clean

    editor.updateNodeWithUndo(
      target.id,
      { pluginData: nextPluginData },
      text ? 'Set tooltip' : 'Clear tooltip'
    )
  }
}

function clearTooltip() {
  draft.value = ''
  commitTooltip()
}
</script>

<template>
  <PanelSection v-if="node" label="Minecraft Tooltip" :empty="!activeTooltip">
    <template #actions>
      <IconButton
        v-if="activeTooltip"
        label="Clear tooltip"
        size="xs"
        @click="clearTooltip"
      >
        <icon-lucide-trash-2 class="size-3.5 text-muted hover:text-danger" />
      </IconButton>
    </template>

    <div class="flex flex-col gap-1.5">
      <AppTextarea
        v-model="draft"
        :rows="2"
        placeholder="Текст тултипа (§eYellow§r, \n для строк...)"
        @blur="commitTooltip"
        @keydown.enter.ctrl="commitTooltip"
        @keydown.enter.meta="commitTooltip"
      />
      <div v-if="activeTooltip" class="flex items-center justify-between text-[10px] text-muted">
        <span>Скрытое свойство (pluginData: tooltip)</span>
        <span class="font-mono">{{ activeTooltip.length }} симв.</span>
      </div>
    </div>
  </PanelSection>
</template>
