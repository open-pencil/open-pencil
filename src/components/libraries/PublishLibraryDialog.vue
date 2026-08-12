<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { publishLibraryDialogOpen, useLibraryService } from '@/app/libraries'
import AppInput from '@/components/ui/AppInput.vue'
import { AppDialogFooter, AppDialogHeader, AppDialogRoot } from '@/components/ui/dialog'

const editor = useEditorStore()
const service = useLibraryService()
const { panels } = useI18n()
const libraryId = ref('')
const libraryName = ref('')
const description = ref('')
const publishing = ref(false)
const error = ref('')
const previousRevisionId = computed(
  () => service.summaries.value.find((item) => item.libraryId === libraryId.value)?.latestRevisionId
)

watch(publishLibraryDialogOpen, (open) => {
  if (!open) return
  error.value = ''
  if (!libraryName.value) libraryName.value = editor.graph.getNode(editor.graph.rootId)?.name ?? ''
})

async function publish() {
  const id = libraryId.value.trim()
  const name = libraryName.value.trim()
  if (!id || !name) return
  publishing.value = true
  error.value = ''
  try {
    await service.publish({
      libraryId: id,
      name,
      graph: editor.graph,
      description: description.value,
      previousRevisionId: previousRevisionId.value ?? null
    })
    publishLibraryDialogOpen.value = false
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : panels.value.libraryPublishFailed
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <AppDialogRoot v-model:open="publishLibraryDialogOpen" size="sm">
    <AppDialogHeader :heading="panels.publishLibrary" :description="panels.publishLibraryHelp" />
    <form class="flex flex-col gap-3 px-4 py-3" @submit.prevent="publish">
      <label class="flex flex-col gap-1 text-[11px] text-muted">
        {{ panels.libraryId }}
        <AppInput v-model="libraryId" required :disabled="!!previousRevisionId" />
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-muted">
        {{ panels.libraryName }}
        <AppInput v-model="libraryName" required />
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-muted">
        {{ panels.revisionDescription }}
        <AppInput v-model="description" />
      </label>
      <p v-if="error" role="alert" class="text-xs text-danger">{{ error }}</p>
    </form>
    <AppDialogFooter>
      <button
        type="button"
        class="h-7 rounded px-3 text-xs text-muted hover:bg-hover"
        @click="publishLibraryDialogOpen = false"
      >
        {{ panels.cancel }}
      </button>
      <button
        type="button"
        class="h-7 rounded bg-accent px-3 text-xs text-white disabled:opacity-50"
        :disabled="publishing || !libraryId.trim() || !libraryName.trim()"
        @click="publish"
      >
        {{ publishing ? panels.publishingLibrary : panels.publishLibrary }}
      </button>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
