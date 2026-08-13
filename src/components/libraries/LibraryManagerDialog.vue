<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { createActiveStorageAdapter, storagePreferencesComplete } from '@/app/integrations/storage'
import { activeStorageProviderID } from '@/app/integrations/storage/preferences'
import {
  openPublishLibraryDialog,
  readLibraryCatalogSource,
  readLibraryPriority,
  StorageLibraryCatalog,
  useLibraryService
} from '@/app/libraries'
import type { LibraryAssetUpdateGroup } from '@/app/libraries/update-groups'
import { scopeLibraryUpdateGroups } from '@/app/libraries/update-groups'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import { AppDialogFooter, AppDialogHeader, AppDialogRoot } from '@/components/ui/dialog'

const open = defineModel<boolean>({ required: true })
const editor = useEditorStore()
const service = useLibraryService()
const { panels, dialogs } = useI18n()
const section = ref<'browse' | 'updates'>('browse')
const loading = ref(false)
const showAllPages = ref(false)
const applying = ref<string | null>(null)
const updateGroups = ref<LibraryAssetUpdateGroup[]>([])
const navigationClass =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-hover hover:text-surface data-[state=active]:bg-hover data-[state=active]:text-surface'

const visibleUpdateGroups = computed(() =>
  scopeLibraryUpdateGroups(editor, updateGroups.value, showAllPages.value)
)

async function refreshUpdates() {
  updateGroups.value = await service.getUpdateGroups(editor)
}

watch(
  () => [open.value, service.updates.value, editor.state.currentPageId] as const,
  ([isOpen]) => {
    if (isOpen) void refreshUpdates()
  },
  { immediate: true }
)

onMounted(() => {
  const source = readLibraryCatalogSource()
  if (source === 'storage') void setSource('storage')
  else void service.refresh(editor)
})

async function setSource(source: 'local' | 'storage') {
  loading.value = true
  try {
    if (source === 'local') service.useLocalCatalog()
    else {
      const providerId = activeStorageProviderID.value
      if (!storagePreferencesComplete(providerId))
        throw new Error(panels.value.storageNotConfigured)
      const objects = createActiveStorageAdapter(providerId).libraryObjects
      if (!objects) throw new Error(panels.value.storageLibrariesUnavailable)
      service.useStorageCatalog(new StorageLibraryCatalog(objects))
    }
    await service.refresh(editor)
    await refreshUpdates()
  } finally {
    loading.value = false
  }
}

async function toggleLibrary(libraryId: string) {
  if (editor.graph.enabledLibraries.get(libraryId)?.enabled)
    await service.disable(editor, libraryId)
  else await service.enable(editor, libraryId)
}

function preferLibrary(libraryId: string) {
  const priority = Math.max(
    0,
    ...service.summaries.value.map((item) => readLibraryPriority(item.libraryId))
  )
  service.setPriority(libraryId, priority + 1)
}

async function updateAsset(libraryId: string, assetKey: string) {
  applying.value = `${libraryId}:${assetKey}`
  try {
    const group = visibleUpdateGroups.value.find(
      (item) => item.libraryId === libraryId && item.assetKey === assetKey
    )
    if (group) await service.applyUpdateGroups(editor, [group], `Update ${group.name}`)
    await refreshUpdates()
  } finally {
    applying.value = null
  }
}

async function updateAll() {
  applying.value = 'all'
  try {
    await service.applyUpdateGroups(editor, visibleUpdateGroups.value, 'Update all library assets')
    await refreshUpdates()
  } finally {
    applying.value = null
  }
}
</script>

<template>
  <AppDialogRoot v-model:open="open" size="lg" height="tall" data-test-id="asset-libraries-dialog">
    <AppDialogHeader :heading="panels.manageLibraries" :close-label="dialogs.close">
      <template #actions>
        <button
          type="button"
          class="ml-auto text-xs text-component hover:underline"
          @click="openPublishLibraryDialog"
        >
          {{ panels.publishLibrary }}
        </button>
      </template>
    </AppDialogHeader>
    <div class="flex min-h-0 flex-1">
      <nav class="w-40 shrink-0 border-r border-border p-2" :aria-label="panels.manageLibraries">
        <button
          type="button"
          :class="navigationClass"
          :data-state="section === 'browse' ? 'active' : 'inactive'"
          @click="section = 'browse'"
        >
          <icon-lucide-library class="size-3.5" /> {{ panels.browseLibraries }}
        </button>
        <button
          type="button"
          :class="navigationClass"
          :data-state="section === 'updates' ? 'active' : 'inactive'"
          @click="section = 'updates'"
        >
          <icon-lucide-refresh-cw class="size-3.5" /> {{ panels.libraryUpdates }}
          <span
            v-if="visibleUpdateGroups.length"
            class="ml-auto rounded-full bg-accent px-1.5 text-[10px] text-white"
            >{{ visibleUpdateGroups.length }}</span
          >
        </button>
      </nav>
      <section v-if="section === 'browse'" class="min-h-0 flex-1 overflow-y-auto p-4">
        <div class="mb-4 flex gap-1">
          <button
            type="button"
            class="rounded px-2 py-1 text-xs data-[active=true]:bg-hover"
            :data-active="service.catalogSource === 'local'"
            @click="setSource('local')"
          >
            {{ panels.localLibraries }}
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs data-[active=true]:bg-hover"
            :data-active="service.catalogSource === 'storage'"
            @click="setSource('storage')"
          >
            {{ panels.storageLibraries }}
          </button>
        </div>
        <div
          v-for="library in service.summaries.value"
          :key="library.libraryId"
          class="flex items-center gap-3 border-b border-border py-3"
        >
          <icon-lucide-library class="size-4 text-component" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs text-surface">{{ library.name }}</p>
            <p class="text-[10px] text-muted">
              {{ panels.libraryAssetCount({ count: library.assetCount }) }}
            </p>
          </div>
          <button
            v-if="editor.graph.enabledLibraries.get(library.libraryId)?.enabled"
            type="button"
            class="text-muted hover:text-component"
            :aria-label="panels.preferLibrary"
            @click="preferLibrary(library.libraryId)"
          >
            <icon-lucide-star class="size-4" />
          </button>
          <button
            type="button"
            class="rounded border border-border px-2 py-1 text-xs"
            :disabled="loading"
            @click="toggleLibrary(library.libraryId)"
          >
            {{
              editor.graph.enabledLibraries.get(library.libraryId)?.enabled
                ? panels.disableLibrary
                : panels.enableLibrary
            }}
          </button>
        </div>
        <AppPlaceholder
          v-if="!loading && service.summaries.value.length === 0"
          :label="panels.noLibraries"
          size="compact"
        />
      </section>
      <section v-else class="flex min-h-0 flex-1 flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          <h3 class="mb-3 text-sm font-semibold text-surface">{{ panels.libraryUpdates }}</h3>
          <div
            v-for="asset in visibleUpdateGroups"
            :key="`${asset.libraryId}:${asset.assetKey}`"
            class="flex items-center gap-3 border-b border-border py-3"
          >
            <icon-lucide-component class="size-4 text-component" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs text-surface">{{ asset.name }}</p>
              <p data-test-id="library-update-instance-count" class="text-[10px] text-muted">
                {{ asset.instanceIds.length }} instances
              </p>
            </div>
            <button
              type="button"
              class="rounded border border-border px-3 py-1 text-xs"
              :disabled="applying !== null"
              @click="updateAsset(asset.libraryId, asset.assetKey)"
            >
              {{ panels.updateLibraryAsset }}
            </button>
          </div>
          <AppPlaceholder
            v-if="visibleUpdateGroups.length === 0"
            :label="panels.noLibraryUpdates"
            size="compact"
          />
        </div>
        <AppDialogFooter :ui="{ footer: 'justify-between' }">
          <label class="flex items-center gap-2 text-xs text-muted"
            ><AppSwitch v-model="showAllPages" :label="panels.showUpdatesForAllPages" />{{
              panels.showUpdatesForAllPages
            }}</label
          >
          <button
            type="button"
            class="rounded bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-50"
            :disabled="visibleUpdateGroups.length === 0 || applying !== null"
            @click="updateAll"
          >
            {{ panels.updateAll }}
          </button>
        </AppDialogFooter>
      </section>
    </div>
  </AppDialogRoot>
</template>
