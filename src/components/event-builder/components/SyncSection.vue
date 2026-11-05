<script setup lang="ts">
import { ref } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import { useShadrStore } from '../useShadrStore'

const editor = useEditorStore()
const shadr = useShadrStore()
const pageNameDraft = ref(shadr.selectedPageId.value || 'main_menu')

function handlePullPage() {
  if (!shadr.selectedPageId.value) return
  void shadr.pullPage(shadr.selectedPageId.value, editor)
}

function handlePushPage() {
  const name = pageNameDraft.value.trim() || 'main_menu'
  void shadr.pushCurrentPage(editor, name)
}
</script>

<template>
  <PanelSection label="Синхронизация меню">
    <div class="flex flex-col gap-2.5">
      <div class="flex flex-col gap-1">
        <label class="text-[10px] text-muted font-medium">Страница на сервере</label>
        <div class="flex items-center gap-1.5">
          <select
            v-model="shadr.selectedPageId.value"
            class="flex-1 h-7 px-2 rounded bg-surface border border-border text-xs focus:outline-none focus:border-primary"
          >
            <option v-for="id in shadr.serverPages.value" :key="id" :value="id">
              {{ id }}
            </option>
          </select>
          <AppButton
            size="xs"
            variant="ghost"
            :disabled="shadr.isSyncing.value || !shadr.selectedPageId.value"
            @click="handlePullPage"
          >
            <icon-lucide-download class="size-3 mr-1" />
            Pull
          </AppButton>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-[10px] text-muted font-medium">Имя для сохранения</label>
        <div class="flex items-center gap-1.5">
          <AppInput v-model="pageNameDraft" placeholder="main_menu" class="flex-1" />
          <AppButton
            size="xs"
            color="primary"
            variant="solid"
            :disabled="shadr.isSyncing.value"
            @click="handlePushPage"
          >
            <icon-lucide-upload-cloud class="size-3 mr-1" />
            Deploy
          </AppButton>
        </div>
      </div>

      <div v-if="shadr.lastError.value" class="text-[11px] text-danger bg-danger/10 p-2 rounded border border-danger/20">
        {{ shadr.lastError.value }}
      </div>
    </div>
  </PanelSection>
</template>
