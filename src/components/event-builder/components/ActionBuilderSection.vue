<script setup lang="ts">
import { ref, watch } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const { node } = defineProps<{
  node: SceneNode
}>()

const editor = useEditorStore()
const actions = ref<string[]>([])
const newActionText = ref('')

watch(
  () => node,
  (currentNode) => {
    const data = getShadrData(currentNode)
    actions.value = [...(data.onClickAction ?? [])]
  },
  { immediate: true, deep: true }
)

function commit() {
  const targets = editor.getSelectedNodes()
  setShadrData(editor, targets.length > 0 ? targets : [node], {
    onClickAction: actions.value.length > 0 ? actions.value : undefined
  })
}

function addAction(actionStr: string) {
  if (!actionStr.trim()) return
  actions.value.push(actionStr.trim())
  newActionText.value = ''
  commit()
}

function removeAction(index: number) {
  actions.value.splice(index, 1)
  commit()
}
</script>

<template>
  <PanelSection label="Действия по клику (onClickAction)">
    <div class="flex flex-col gap-2">
      <div v-if="actions.length > 0" class="flex flex-col gap-1.5">
        <div
          v-for="(act, idx) in actions"
          :key="idx"
          class="flex items-center justify-between gap-2 px-2 py-1 rounded bg-surface/70 border border-border/40 font-mono text-[11px]"
        >
          <span class="truncate flex-1">{{ act }}</span>
          <IconButton label="Удалить" size="xs" @click="removeAction(idx)">
            <icon-lucide-x class="size-3 text-muted hover:text-danger" />
          </IconButton>
        </div>
      </div>
      <div v-else class="text-[11px] text-muted/70 italic py-1">Нет действий по клику</div>

      <div class="flex items-center gap-1.5 mt-1">
        <AppInput
          v-model="newActionText"
          placeholder="sound: shadr.click"
          class="flex-1 font-mono text-[11px]"
          @keydown.enter="addAction(newActionText)"
        />
        <AppButton size="xs" variant="ghost" @click="addAction(newActionText)">
          <icon-lucide-plus class="size-3" />
        </AppButton>
      </div>

      <div class="flex flex-col gap-1 mt-1">
        <span class="text-[10px] text-muted font-medium">Быстрые шаблоны:</span>
        <div class="flex flex-wrap gap-1">
          <button type="button" class="px-1.5 py-0.5 rounded bg-surface border border-border/50 text-[10px] hover:border-primary font-mono" @click="addAction('sound: shadr.click')">
            🔊 shadr.click
          </button>
          <button type="button" class="px-1.5 py-0.5 rounded bg-surface border border-border/50 text-[10px] hover:border-primary font-mono" @click="addAction('sound: shadr.close')">
            🔇 shadr.close
          </button>
          <button type="button" class="px-1.5 py-0.5 rounded bg-surface border border-border/50 text-[10px] hover:border-primary font-mono" @click="addAction('open: shop')">
            📄 open: shop
          </button>
          <button type="button" class="px-1.5 py-0.5 rounded bg-surface border border-border/50 text-[10px] hover:border-primary font-mono" @click="addAction('close:')">
            ❌ close:
          </button>
        </div>
      </div>
    </div>
  </PanelSection>
</template>
