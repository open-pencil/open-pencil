<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { LibraryAssetChange } from '@open-pencil/core/library'
import {
  ensureLibraryAssetKeys,
  publishableLibraryAssets,
  readSourceLibraryPublication
} from '@open-pencil/core/library'
import { useMessages } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import { publishLibraryDialogOpen, useLibraryService } from '@/app/libraries'
import { LibraryContentFailedError, LibraryContentSyncingError } from '@/app/libraries/errors'
import { kickLibrarySync, librarySyncResolution, resumeLibrarySync } from '@/app/libraries/sync'
import AppButton from '@/components/ui/button/AppButton.vue'
import {
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot,
  useDialogUI
} from '@/components/ui/dialog'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'

const editor = useEditorStore()
const dialog = useDialogUI()
const service = useLibraryService()
const libraryMessages = useMessages('panels/libraries')
const libraryId = ref('')
const libraryName = ref('')
const description = ref('')
const query = ref('')
const publishing = ref(false)
const loading = ref(false)
const error = ref('')
/** The baseline revision's mirror state: syncing while it pulls, failed once it parks. */
const baselineState = ref<'syncing' | 'failed' | null>(null)
const changes = ref<LibraryAssetChange[]>([])
const selectedKeys = ref(new Set<string>())
/** Serializes overlapping discoveries: only the latest `loadChanges` result may land. */
let discoverySequence = 0
const changeLabels = computed(() => ({
  added: libraryMessages.value.libraryChangeAdded,
  modified: libraryMessages.value.libraryChangeModified,
  renamed: libraryMessages.value.libraryChangeRenamed,
  removed: libraryMessages.value.libraryChangeRemoved
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

async function loadChanges() {
  // Discoveries overlap — the resolution watch, a retry, and a reopen can all be in
  // flight — and resolve out of order, so only the latest call writes its result: an
  // older answer landing last would reselect deselected assets and revert the baseline.
  const discovery = ++discoverySequence
  error.value = ''
  loading.value = true
  // A new discovery drops the previous selection: its answer repopulates the list, and a
  // baseline miss leaves nothing selected behind the syncing or failed row.
  changes.value = []
  selectedKeys.value = new Set()
  try {
    const discovered = await service.discoverPublicationChanges(editor)
    if (discovery !== discoverySequence) return
    changes.value = discovered.changes
    selectedKeys.value = new Set(changes.value.map((change) => change.asset.key))
    baselineState.value = null
  } catch (cause) {
    if (discovery !== discoverySequence) return
    // A baseline revision still pulling shows the syncing row, not an error: the engine
    // lands it and the resolution watch retries the discovery. A baseline the engine has
    // parked shows the failed row with a retry instead of the syncing row.
    if (cause instanceof LibraryContentSyncingError) {
      baselineState.value = 'syncing'
    } else if (cause instanceof LibraryContentFailedError) {
      baselineState.value = 'failed'
    } else {
      baselineState.value = null
      error.value =
        cause instanceof Error ? cause.message : libraryMessages.value.libraryPublishFailed
    }
  } finally {
    if (discovery === discoverySequence) loading.value = false
  }
}

watch(publishLibraryDialogOpen, async (open) => {
  if (!open) return
  // A discovery still in flight from the previous opening must not land in this one.
  discoverySequence += 1
  // Selective publishing diffs against the publication's baseline revision; ask the engine
  // to mirror it while the change list computes.
  void kickLibrarySync({ includePublication: true, probe: false })
  error.value = ''
  baselineState.value = null
  query.value = ''
  const existing = publication.value
  libraryId.value = existing?.libraryId ?? libraryId.value
  libraryName.value = existing?.name ?? editor.graph.getNode(editor.graph.rootId)?.name ?? ''
  if (existing) {
    await loadChanges()
    return
  }
  loading.value = true
  try {
    ensureLibraryAssetKeys(editor.graph)
    changes.value = publishableLibraryAssets(editor.graph).map((asset) => ({
      kind: 'added' as const,
      asset: { ...asset, contentHash: '' }
    }))
    selectedKeys.value = new Set(changes.value.map((change) => change.asset.key))
  } finally {
    loading.value = false
  }
})

// A baseline revision that lands while the dialog waits retries the discovery. The watch
// fires in the failed state too: a retry clears the marks, and an engine retry landing
// resolves the baseline on its own.
watch(librarySyncResolution, () => {
  if (
    (baselineState.value === 'syncing' || baselineState.value === 'failed') &&
    publishLibraryDialogOpen.value
  ) {
    void loadChanges()
  }
})

/**
 * A failed baseline retry clears its mark and resumes the engine — permanent failures park
 * the pump, which a bare kick would not wake — then the discovery reloads.
 */
function retrySync() {
  void resumeLibrarySync().then(() => void loadChanges())
}

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
  if (!id || !name || selectedKeys.value.size === 0 || publishing.value || baselineState.value)
    return
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
    error.value =
      cause instanceof Error ? cause.message : libraryMessages.value.libraryPublishFailed
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <AppDialogRoot v-model:open="publishLibraryDialogOpen" size="md" height="tall">
    <AppDialogHeader
      :heading="libraryMessages.publishLibrary"
      :description="libraryMessages.publishLibraryHelp"
    />
    <form
      :class="[dialog.pane, 'flex min-h-0 flex-1 flex-col gap-3 px-4 py-4']"
      @submit.prevent="publish"
    >
      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1.5 text-xs text-muted">
          {{ libraryMessages.libraryId }}
          <AppInput v-model="libraryId" required size="md" :disabled="!!publication" />
        </label>
        <label class="flex flex-col gap-1.5 text-xs text-muted">
          {{ libraryMessages.libraryName }}
          <AppInput v-model="libraryName" required size="md" />
        </label>
      </div>
      <AppInput
        v-model="query"
        type="search"
        size="md"
        :placeholder="libraryMessages.searchLibraryChanges"
      />
      <label class="flex flex-col gap-1.5 text-xs text-muted">
        {{ libraryMessages.revisionDescription }}
        <AppTextarea v-model="description" :rows="2" />
      </label>
      <div
        class="flex items-center justify-between rounded-lg border border-border bg-input px-3 py-2 text-xs"
      >
        <span class="text-muted">{{ libraryMessages.libraryDestination }}</span>
        <span>{{
          service.catalogSource === 'storage'
            ? libraryMessages.storageLibraries
            : libraryMessages.localLibraries
        }}</span>
      </div>
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
        <div class="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium">
          <AppCheckbox
            :model-value="selectionState"
            :ariaLabel="libraryMessages.libraryChanges"
            @update:model-value="toggleAll"
          />
          <span>{{ libraryMessages.libraryChanges }}</span>
          <span class="ms-auto text-muted">{{ selectedKeys.size }}/{{ changes.length }}</span>
        </div>
        <div v-if="loading" class="px-3 py-6 text-center text-xs text-muted">
          {{ libraryMessages.loading }}
        </div>
        <div
          v-else-if="baselineState === 'syncing'"
          class="px-3 py-6 text-center text-xs text-muted"
        >
          {{ libraryMessages.librarySyncing }}
        </div>
        <div v-else-if="baselineState === 'failed'" class="px-3 py-6">
          <AppAlert tone="error" :heading="libraryMessages.librarySyncFailed">
            <template #actions>
              <AppButton variant="outline" size="xs" @click="retrySync">
                {{ libraryMessages.retryLibrarySync }}
              </AppButton>
            </template>
          </AppAlert>
        </div>
        <AppPlaceholder
          v-else-if="changes.length === 0"
          :label="libraryMessages.noLibraryAssetChanges"
          size="compact"
        >
          <template #icon><icon-lucide-package-check /></template>
        </AppPlaceholder>
        <AppPlaceholder
          v-else-if="visibleChanges.length === 0"
          :label="libraryMessages.noLibraryChangesFound"
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
              <icon-lucide-palette v-else-if="change.asset.type === 'STYLE'" class="size-4" />
              <icon-lucide-braces
                v-else-if="change.asset.type === 'VARIABLE_COLLECTION'"
                class="size-4"
              />
              <icon-lucide-component v-else class="size-4" />
            </div>
            <span class="min-w-0 flex-1 truncate text-xs">{{ change.asset.name }}</span>
            <span class="text-3xs text-muted">{{ changeLabels[change.kind] }}</span>
          </label>
        </div>
      </div>
      <p v-if="error" role="alert" class="text-xs text-error">{{ error }}</p>
    </form>
    <AppDialogFooter>
      <AppButton size="md" @click="publishLibraryDialogOpen = false">
        {{ libraryMessages.cancel }}
      </AppButton>
      <AppButton
        size="md"
        color="primary"
        variant="solid"
        :disabled="
          publishing ||
          loading ||
          !!baselineState ||
          selectedKeys.size === 0 ||
          !libraryId.trim() ||
          !libraryName.trim()
        "
        @click="publish"
      >
        {{ publishing ? libraryMessages.publishingLibrary : libraryMessages.publishLibrary }}
      </AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
