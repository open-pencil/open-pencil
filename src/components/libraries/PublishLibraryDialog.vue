<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { LibraryAssetChange } from '@open-pencil/core/library'
import {
  ensureLibraryAssetKeys,
  publishableLibraryRoots,
  readSourceLibraryPublication
} from '@open-pencil/core/library'
import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { publishLibraryDialogOpen, useLibraryService } from '@/app/libraries'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import { AppDialogFooter, AppDialogHeader, AppDialogRoot } from '@/components/ui/dialog'

const editor = useEditorStore()
const service = useLibraryService()
const { panels } = useI18n()
const libraryId = ref('')
const libraryName = ref('')
const description = ref('')
const query = ref('')
const publishing = ref(false)
const loading = ref(false)
const error = ref('')
const changes = ref<LibraryAssetChange[]>([])
const selectedKeys = ref(new Set<string>())
const changeLabels = computed(() => ({
  added: panels.value.libraryChangeAdded,
  modified: panels.value.libraryChangeModified,
  renamed: panels.value.libraryChangeRenamed,
  removed: panels.value.libraryChangeRemoved
}))
const publication = computed(() => readSourceLibraryPublication(editor.graph))
const visibleChanges = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  return normalized
    ? changes.value.filter((change) => change.asset.name.toLowerCase().includes(normalized))
    : changes.value
})
const selectionState = computed<boolean | 'indeterminate'>(() => {
  const visibleKeys = visibleChanges.value.map((change) => change.asset.key)
  const selectedVisible = visibleKeys.filter((key) => selectedKeys.value.has(key)).length
  if (selectedVisible === 0) return false
  return selectedVisible === visibleKeys.length ? true : 'indeterminate'
})

watch(publishLibraryDialogOpen, async (open) => {
  if (!open) return
  error.value = ''
  query.value = ''
  loading.value = true
  const existing = publication.value
  libraryId.value = existing?.libraryId ?? libraryId.value
  libraryName.value = existing?.name ?? editor.graph.getNode(editor.graph.rootId)?.name ?? ''
  try {
    if (existing) {
      const discovered = await service.discoverPublicationChanges(editor)
      changes.value = discovered.changes
    } else {
      const roots = publishableLibraryRoots(editor.graph)
      ensureLibraryAssetKeys(
        editor.graph,
        roots.map((node) => node.id)
      )
      changes.value = roots.map((node) => ({
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
  const visibleKeys = visibleChanges.value.map((change) => change.asset.key)
  const next = new Set(selectedKeys.value)
  for (const key of visibleKeys) {
    if (value) next.add(key)
    else next.delete(key)
  }
  selectedKeys.value = next
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
  <AppDialogRoot v-model:open="publishLibraryDialogOpen" size="md" height="tall">
    <AppDialogHeader :heading="panels.publishLibrary" :description="panels.publishLibraryHelp" />
    <form class="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4" @submit.prevent="publish">
      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1.5 text-xs text-muted">
          {{ panels.libraryId }}
          <AppInput v-model="libraryId" required size="md" :disabled="!!publication" />
        </label>
        <label class="flex flex-col gap-1.5 text-xs text-muted">
          {{ panels.libraryName }}
          <AppInput v-model="libraryName" required size="md" />
        </label>
      </div>
      <AppInput
        v-model="query"
        type="search"
        size="md"
        :placeholder="panels.searchLibraryChanges"
      />
      <label class="flex flex-col gap-1.5 text-xs text-muted">
        {{ panels.revisionDescription }}
        <AppTextarea v-model="description" :rows="2" />
      </label>
      <div
        class="flex items-center justify-between rounded-lg border border-border bg-input px-3 py-2 text-xs"
      >
        <span class="text-muted">{{ panels.libraryDestination }}</span>
        <span>{{
          service.catalogSource === 'storage' ? panels.storageLibraries : panels.localLibraries
        }}</span>
      </div>
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
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
        <AppPlaceholder
          v-else-if="changes.length === 0"
          :label="panels.noLibraryAssetChanges"
          size="compact"
        >
          <template #icon><icon-lucide-package-check /></template>
        </AppPlaceholder>
        <AppPlaceholder
          v-else-if="visibleChanges.length === 0"
          :label="panels.noLibraryChangesFound"
          size="compact"
        >
          <template #icon><icon-lucide-search-x /></template>
        </AppPlaceholder>
        <div v-else class="min-h-0 overflow-y-auto">
          <label
            v-for="change in visibleChanges"
            :key="change.asset.key"
            class="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
          >
            <AppCheckbox
              :model-value="selectedKeys.has(change.asset.key)"
              :ariaLabel="change.asset.name"
              @update:model-value="(value) => toggleAsset(change.asset.key, value)"
            />
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-canvas text-muted"
            >
              <icon-lucide-layout-template
                v-if="change.asset.type === 'COMPONENT_SET'"
                class="size-4"
              />
              <icon-lucide-component v-else class="size-4" />
            </div>
            <span class="min-w-0 flex-1 truncate text-xs">{{ change.asset.name }}</span>
            <span class="text-[10px] text-muted">{{ changeLabels[change.kind] }}</span>
          </label>
        </div>
      </div>
      <p v-if="error" role="alert" class="text-xs text-danger">{{ error }}</p>
    </form>
    <AppDialogFooter>
      <button
        type="button"
        class="h-8 rounded-md px-3 text-xs text-muted hover:bg-hover"
        @click="publishLibraryDialogOpen = false"
      >
        {{ panels.cancel }}
      </button>
      <button
        type="button"
        class="h-8 rounded-md bg-accent px-4 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
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
