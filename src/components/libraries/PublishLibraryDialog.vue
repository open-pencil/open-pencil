<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { LibraryAssetChange } from '@open-pencil/core/library'
import { readSourceLibraryPublication } from '@open-pencil/core/library'
import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { publishLibraryDialogOpen, useLibraryService } from '@/app/libraries'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { AppDialogFooter, AppDialogHeader, AppDialogRoot } from '@/components/ui/dialog'

const editor = useEditorStore()
const service = useLibraryService()
const { panels } = useI18n()
const libraryId = ref('')
const libraryName = ref('')
const description = ref('')
const publishing = ref(false)
const loading = ref(false)
const error = ref('')
const changes = ref<LibraryAssetChange[]>([])
const selectedKeys = ref(new Set<string>())
const publication = computed(() => readSourceLibraryPublication(editor.graph))
const selectionState = computed<boolean | 'indeterminate'>(() => {
  if (selectedKeys.value.size === 0) return false
  return selectedKeys.value.size === changes.value.length ? true : 'indeterminate'
})

watch(publishLibraryDialogOpen, async (open) => {
  if (!open) return
  error.value = ''
  loading.value = true
  const existing = publication.value
  libraryId.value = existing?.libraryId ?? libraryId.value
  libraryName.value = existing?.name ?? editor.graph.getNode(editor.graph.rootId)?.name ?? ''
  try {
    if (existing) {
      const discovered = await service.discoverPublicationChanges(editor)
      changes.value = discovered.changes
    } else {
      changes.value = [...editor.graph.getAllNodes()]
        .filter(
          (node): node is typeof node & { type: 'COMPONENT' | 'COMPONENT_SET' } =>
            node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'
        )
        .map((node) => ({
          kind: 'added' as const,
          asset: {
            key: node.componentKey ?? node.id,
            name: node.name,
            description: '',
            type: node.type,
            sourceNodeId: node.id,
            contentHash: ''
          }
        }))
    }
    selectedKeys.value = new Set(changes.value.map((change) => change.asset.key))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : panels.value.libraryPublishFailed
  } finally {
    loading.value = false
  }
})

function toggleAll(value: boolean) {
  selectedKeys.value = value ? new Set(changes.value.map((change) => change.asset.key)) : new Set()
}

function toggleAsset(key: string, value: boolean) {
  const next = new Set(selectedKeys.value)
  if (value) next.add(key)
  else next.delete(key)
  selectedKeys.value = next
}

async function publish() {
  const id = libraryId.value.trim()
  const name = libraryName.value.trim()
  if (!id || !name || selectedKeys.value.size === 0 || publishing.value) return
  publishing.value = true
  error.value = ''
  try {
    await service.publishSelected(editor, {
      libraryId: id,
      name,
      description: description.value,
      selectedAssetKeys: selectedKeys.value
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
    <form class="flex min-h-0 flex-col gap-3 px-4 py-3" @submit.prevent="publish">
      <label class="flex flex-col gap-1 text-[11px] text-muted">
        {{ panels.libraryId }}
        <AppInput v-model="libraryId" required :disabled="!!publication" />
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-muted">
        {{ panels.libraryName }}
        <AppInput v-model="libraryName" required />
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-muted">
        {{ panels.revisionDescription }}
        <AppInput v-model="description" />
      </label>
      <div class="rounded border border-border">
        <div class="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium">
          <AppCheckbox
            :model-value="selectionState"
            :ariaLabel="panels.libraryChanges"
            @update:model-value="toggleAll"
          />
          <span>{{ panels.libraryChanges }}</span>
          <span class="ml-auto text-muted">{{ selectedKeys.size }}/{{ changes.length }}</span>
        </div>
        <div v-if="loading" class="px-3 py-6 text-center text-xs text-muted">
          {{ panels.loading }}
        </div>
        <div v-else-if="changes.length === 0" class="px-3 py-6 text-center text-xs text-muted">
          {{ panels.noLibraryAssetChanges }}
        </div>
        <label
          v-for="change in changes"
          v-else
          :key="change.asset.key"
          class="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
        >
          <AppCheckbox
            :model-value="selectedKeys.has(change.asset.key)"
            :ariaLabel="change.asset.name"
            @update:model-value="(value) => toggleAsset(change.asset.key, value)"
          />
          <span class="min-w-0 flex-1 truncate text-xs">{{ change.asset.name }}</span>
          <span class="text-[10px] capitalize text-muted">{{ change.kind }}</span>
        </label>
      </div>
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
        :disabled="
          publishing ||
          loading ||
          selectedKeys.size === 0 ||
          !libraryId.trim() ||
          !libraryName.trim()
        "
        @click="publish"
      >
        {{ publishing ? panels.publishingLibrary : panels.publishLibrary }}
      </button>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
