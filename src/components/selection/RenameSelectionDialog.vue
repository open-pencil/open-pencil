<script setup lang="ts">
import { computed, nextTick, ref, watch, useTemplateRef } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import {
  AppDialogBody,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'

const store = useEditorStore()
const name = computed(() => store.selectedNodes.value[0]?.name ?? '')
const draft = ref('')
const input = useTemplateRef<HTMLInputElement>('input')

watch(
  () => store.state.renameSelectionOpen,
  (open) => {
    if (!open) return
    draft.value = name.value
    void nextTick(() => input.value?.select())
  }
)

function submit() {
  if (store.state.selectedIds.size === 0) return
  store.renameSelected(draft.value)
  store.state.renameSelectionOpen = false
}
</script>

<template>
  <AppDialogRoot v-model:open="store.state.renameSelectionOpen" size="sm">
    <AppDialogHeader heading="Rename selection" close-label="Close" />
    <AppDialogBody>
      <label class="flex flex-col gap-1.5 text-xs text-muted">
        Layer name
        <input
          ref="input"
          v-model="draft"
          class="h-8 rounded border border-border bg-input px-2 text-sm text-surface outline-none focus:border-panel-focus"
          @keydown.enter.prevent="submit"
        />
      </label>
    </AppDialogBody>
    <AppDialogFooter>
      <button
        type="button"
        class="h-8 cursor-pointer rounded bg-accent px-3 text-xs font-medium text-white"
        @click="submit"
      >
        Rename
      </button>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
