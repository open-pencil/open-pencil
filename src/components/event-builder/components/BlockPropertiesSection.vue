<script setup lang="ts">
import { ref, watch } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import type { ShadrNodeData } from '@/app/integrations/shadr/types'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const { node } = defineProps<{
  node: SceneNode
}>()

const editor = useEditorStore()
const blockId = ref('')
const layer = ref<number | ''>('')
const isInteractive = ref(false)
const hoverEffect = ref('none')
const clickEffect = ref('none')

watch(
  () => node,
  (currentNode) => {
    const data = getShadrData(currentNode)
    blockId.value = data.blockId ?? ''
    layer.value = data.layer !== undefined ? data.layer : ''
    isInteractive.value = data.interactive ?? false
    hoverEffect.value = data.hoverEffect || 'none'
    clickEffect.value = data.clickEffect || 'none'
  },
  { immediate: true, deep: true }
)

function commit() {
  const patch: Partial<ShadrNodeData> = {
    blockId: blockId.value.trim() || undefined,
    layer: layer.value === '' ? undefined : Number(layer.value),
    interactive: isInteractive.value,
    hoverEffect: hoverEffect.value === 'none' ? undefined : hoverEffect.value,
    clickEffect: clickEffect.value === 'none' ? undefined : clickEffect.value
  }
  const targets = editor.getSelectedNodes()
  setShadrData(editor, targets.length > 0 ? targets : [node], patch)
}
</script>

<template>
  <PanelSection label="Свойства блока Shadr">
    <div class="flex flex-col gap-2.5">
      <div class="flex items-center justify-between gap-2">
        <label class="text-[11px] text-muted w-20 shrink-0">Block ID</label>
        <AppInput v-model="blockId" placeholder="menu_button" class="flex-1" @blur="commit" @keydown.enter="commit" />
      </div>

      <div class="flex items-center justify-between gap-2">
        <label class="text-[11px] text-muted w-20 shrink-0">Слой (layer)</label>
        <AppInput v-model="layer" type="number" placeholder="0, 5, 10" class="flex-1" @blur="commit" @keydown.enter="commit" />
      </div>

      <div class="flex items-center justify-between py-1 border-t border-border/30">
        <label class="text-[11px] text-muted">Интерактивный</label>
        <input v-model="isInteractive" type="checkbox" class="size-4 rounded border-border text-primary cursor-pointer" @change="commit" />
      </div>

      <div class="flex items-center justify-between gap-2">
        <label class="text-[11px] text-muted w-20 shrink-0">Hover эффект</label>
        <select v-model="hoverEffect" class="flex-1 h-7 px-2 rounded bg-surface border border-border text-xs focus:outline-none" @change="commit">
          <option value="none">none (нет)</option>
          <option value="lift">lift (поднятие)</option>
          <option value="press">press (нажатие)</option>
          <option value="glow">glow (свечение)</option>
          <option value="nudge">nudge (смещение)</option>
          <option value="pop">pop (пульс)</option>
          <option value="sink">sink (утопление)</option>
          <option value="tilt">tilt (наклон)</option>
        </select>
      </div>

      <div class="flex items-center justify-between gap-2">
        <label class="text-[11px] text-muted w-20 shrink-0">Click эффект</label>
        <select v-model="clickEffect" class="flex-1 h-7 px-2 rounded bg-surface border border-border text-xs focus:outline-none" @change="commit">
          <option value="none">none (нет)</option>
          <option value="press">press (нажатие)</option>
          <option value="lift">lift (поднятие)</option>
        </select>
      </div>
    </div>
  </PanelSection>
</template>
