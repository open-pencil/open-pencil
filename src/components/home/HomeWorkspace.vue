<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import { useDocumentWorkspace, useI18n, useViewportKind, vTestId } from '@open-pencil/vue'

import {
  activeStorageProviderID,
  readStoragePreferences,
  storagePreferencesComplete,
  storageProviderRegistry,
  type StorageDocument
} from '@/app/integrations/storage'
import { useCredentialSettings } from '@/app/settings/credentials/preferences/use'
import { openSettingsDialog } from '@/app/settings/dialog'
import { resolveLibraryConflict } from '@/app/storage/workspace/conflict'
import { downloadSlideDeck } from '@/app/storage/workspace/open'
import { createStorageWorkspaceSource, type LibraryDocument } from '@/app/storage/workspace/source'
import {
  createTrashSource,
  emptyTrash,
  moveDesignToTrash,
  restoreDesign,
  type TrashedDesign
} from '@/app/storage/workspace/trash'
import { openStorageDocumentInNewTab } from '@/app/tabs'
import DesignCardMenu from '@/components/home/document/DesignCardMenu.vue'
import DocumentEntry from '@/components/home/document/DocumentEntry.vue'
import LibraryStatus from '@/components/home/library/LibraryStatus.vue'
import HomeSearchActions from '@/components/home/search/HomeSearchActions.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

const emit = defineEmits<{ 'new-document': [] }>()
const { panels, locale, storage, files, common, settings, credentials } = useI18n()
const { isMobile } = useViewportKind()
const view = useLocalStorage<'grid' | 'list'>('open-pencil:home-files-view', 'grid')
const query = ref('')
const openError = ref<string | null>(null)
const storageConfigured = ref(storagePreferencesComplete(activeStorageProviderID.value))
const syncError = ref<unknown>(null)

// The library, as Figma's Recents: every design saves itself here, on this device, and syncs
// to storage once storage is set up.
const library = useDocumentWorkspace<LibraryDocument>({
  source: createStorageWorkspaceSource((snapshot) => {
    storageConfigured.value = snapshot.configured
    if (!snapshot.localOnly) syncError.value = snapshot.syncError ?? null
  }),
  refreshInterval: 60_000,
  previewConcurrency: 6
})
const designs = library.documents
const loading = library.loading
const previewURL = library.previewURL
const vLibraryPreview = library.previewDirective
// Paused credential access has its own fix, so the notice offers it instead of the raw native error.
const credentialAccess = useCredentialSettings()
async function retryCredentialAccess() {
  await credentialAccess.retry()
  if (!credentialAccess.paused.value) await library.refresh()
}
const libraryError = computed(() => {
  const error = library.error.value ?? syncError.value
  if (error == null) return null
  return error instanceof Error ? error.message : String(error)
})
const storageDescription = computed(() => {
  const provider = storageProviderRegistry.get(activeStorageProviderID.value)
  const preferences = readStoragePreferences(activeStorageProviderID.value)
  const bucket = preferences.bucket?.trim()
  const endpoint = preferences.endpoint?.trim()
  let label = provider.label
  if (endpoint) {
    try {
      const hostname = new URL(endpoint).hostname
      if (hostname.endsWith('.r2.cloudflarestorage.com')) label = storage.value.providerR2
      else if (hostname.includes('amazonaws.com')) label = storage.value.providerAmazonS3
      else if (hostname.includes('backblazeb2.com')) label = storage.value.providerBackblaze
      else if (hostname) label = storage.value.providerS3
    } catch {
      label = provider.label
    }
  }
  return bucket ? `${label} · ${bucket}` : label
})
// Figma's trash: designs moved there leave Recents until they are restored or deleted.
const showingTrash = ref(false)
const trash = useDocumentWorkspace<TrashedDesign>({ source: createTrashSource() })
const trashedDesigns = trash.documents
const trashPreviewURL = trash.previewURL
const vTrashPreview = trash.previewDirective
const normalizedQuery = computed(() => query.value.trim().toLocaleLowerCase(locale.value))
function matchesQuery(design: StorageDocument): boolean {
  return design.name.toLocaleLowerCase(locale.value).includes(normalizedQuery.value)
}
const filteredDesigns = computed(() => designs.value.filter(matchesQuery))
const filteredTrash = computed(() => trashedDesigns.value.filter(matchesQuery))
const shownCount = computed(() =>
  showingTrash.value ? trashedDesigns.value.length : designs.value.length
)
const filteredCount = computed(() =>
  showingTrash.value ? filteredTrash.value.length : filteredDesigns.value.length
)
const designsLayout = computed(() =>
  view.value === 'grid'
    ? 'grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]'
    : 'overflow-hidden rounded-lg border border-border'
)
const shownLoading = computed(() => (showingTrash.value ? trash.loading.value : loading.value))
const noMatches = computed(
  () => Boolean(normalizedQuery.value) && shownCount.value > 0 && filteredCount.value === 0
)

// Permanently deleting cannot be undone, so it asks first.
const deletion = shallowRef<{ ids: string[]; heading: string; description: string } | null>(null)
const deletionOpen = ref(false)
function confirmDeletion(ids: string[], heading: string, description: string): void {
  deletion.value = { ids, heading, description }
  deletionOpen.value = true
}
function confirmDelete(design: StorageDocument): void {
  confirmDeletion(
    [design.id],
    files.value.deletePermanentlyHeading({ name: design.name }),
    files.value.deletePermanentlyDescription
  )
}
function confirmEmptyTrash(): void {
  confirmDeletion(
    trashedDesigns.value.map((design) => design.id),
    files.value.emptyTrashHeading,
    files.value.emptyTrashDescription
  )
}

async function run(action: () => Promise<void>): Promise<void> {
  openError.value = null
  try {
    await action()
  } catch (error) {
    openError.value = error instanceof Error ? error.message : String(error)
  }
}

function openDesign(design: StorageDocument): Promise<void> {
  return run(() => openStorageDocumentInNewTab(design))
}

function downloadDeck(design: StorageDocument): Promise<void> {
  return run(async () => {
    await downloadSlideDeck(design, activeStorageProviderID.value)
  })
}

function resolveConflict(design: StorageDocument, resolution: 'keep-both' | 'use-remote') {
  return run(async () => {
    await resolveLibraryConflict(design.id, resolution)
  })
}

function formattedDate(updatedAt: string): string {
  const date = new Date(updatedAt)
  if (date.getTime() === 0) return ''
  return date.toLocaleString(locale.value)
}

/** A card's metadata: when it changed, that it is a slide deck, or that it is in conflict. */
function designMetadata(design: LibraryDocument): string {
  if (design.conflicted) return files.value.changedOnAnotherDevice
  const date = formattedDate(design.updatedAt)
  return design.sourceFormat === 'deck' ? files.value.deckMetadata({ date }) : date
}

function trashedDate(design: TrashedDesign): string {
  const date = files.value.trashedOn({ date: formattedDate(design.trashedAt) })
  return design.sourceFormat === 'deck' ? files.value.deckMetadata({ date }) : date
}
</script>

<template>
  <main
    class="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-panel text-surface"
    data-test-id="recent-files-home"
  >
    <section
      class="mx-auto flex w-full max-w-7xl flex-col pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-4 pl-[max(1rem,env(safe-area-inset-left))] sm:px-6 sm:py-5"
    >
      <icon-brand-lockup
        role="img"
        aria-label="OpenPencil"
        class="mb-5 block h-8 w-auto text-surface"
      />
      <HomeSearchActions v-model="query" @new-document="emit('new-document')" />

      <p v-if="openError" class="mb-4 text-xs text-error" role="alert">{{ openError }}</p>

      <div class="mb-4 flex flex-wrap items-center gap-2">
        <IconButton
          v-if="showingTrash"
          :label="common.back"
          class="size-10 sm:size-7"
          data-test-id="home-trash-back"
          @click="showingTrash = false"
        >
          <icon-lucide-chevron-left class="size-4" />
        </IconButton>
        <h1 class="text-base font-semibold">{{ showingTrash ? files.trash : files.recents }}</h1>
        <div class="ml-auto flex min-w-0 items-center gap-1">
          <AppButton
            v-if="showingTrash && trashedDesigns.length"
            variant="outline"
            data-test-id="home-empty-trash"
            @click="confirmEmptyTrash"
          >
            {{ files.emptyTrash }}
          </AppButton>
          <template v-if="!showingTrash">
            <span class="hidden min-w-0 sm:inline-flex">
              <LibraryStatus :configured="storageConfigured" :location="storageDescription" />
            </span>
            <IconButton
              v-if="storageConfigured"
              :label="common.refresh"
              class="size-10 sm:size-7"
              @click="library.refresh"
            >
              <icon-lucide-refresh-cw class="size-3.5" />
            </IconButton>
            <IconButton
              :label="settings.title"
              class="size-10 sm:size-7"
              @click="openSettingsDialog('storage')"
            >
              <icon-lucide-settings class="size-3.5" />
            </IconButton>
            <IconButton
              :label="files.trash"
              class="size-10 sm:size-7"
              data-test-id="home-trash"
              @click="showingTrash = true"
            >
              <icon-lucide-trash-2 class="size-3.5" />
            </IconButton>
          </template>
          <SegmentedControl
            v-model="view"
            required
            :label="files.recents"
            :size="isMobile ? 'touch' : 'md'"
            :options="[
              { value: 'grid', label: panels.gridView },
              { value: 'list', label: panels.listView }
            ]"
          >
            <template #option="{ option }">
              <icon-lucide-layout-grid v-if="option.value === 'grid'" class="size-3.5" />
              <icon-lucide-list v-else class="size-3.5" />
            </template>
          </SegmentedControl>
        </div>
      </div>

      <AppAlert
        v-if="libraryError && !showingTrash"
        tone="error"
        class="mb-4"
        :heading="files.syncFailed({ location: storageDescription })"
        :description="credentialAccess.paused.value ? credentials.accessPaused : libraryError"
      >
        <template #actions>
          <AppButton
            v-if="credentialAccess.paused.value"
            variant="outline"
            :loading="credentialAccess.busy.value"
            data-test-id="home-storage-retry-access"
            @click="retryCredentialAccess"
          >
            {{ credentials.retryAccess }}
          </AppButton>
          <AppButton v-else variant="outline" @click="library.refresh">
            {{ common.refresh }}
          </AppButton>
        </template>
      </AppAlert>

      <p
        v-if="noMatches"
        class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted"
      >
        {{ files.noMatchingFiles({ query: query.trim() }) }}
      </p>

      <div
        v-if="shownLoading && shownCount === 0"
        class="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
        :aria-label="storage.loadingWorkspace"
      >
        <div
          v-for="index in 3"
          :key="index"
          class="min-w-0 animate-pulse motion-reduce:animate-none"
        >
          <div class="aspect-video rounded-lg border border-border bg-panel-field" />
          <div class="mt-2 h-3 w-2/3 rounded bg-panel-field" />
          <div class="mt-1.5 h-2.5 w-1/3 rounded bg-panel-field" />
        </div>
      </div>

      <div
        v-else-if="filteredCount"
        :class="designsLayout"
        v-test-id="showingTrash ? 'home-trash-list' : 'home-library'"
      >
        <template v-if="showingTrash">
          <DesignCardMenu
            v-for="design in filteredTrash"
            :key="design.id"
            trashed
            @restore="run(() => restoreDesign(design.id))"
            @delete="confirmDelete(design)"
          >
            <DocumentEntry
              v-trash-preview="design.id"
              :view="view"
              :name="design.name"
              :metadata="trashedDate(design)"
              :previewURL="trashPreviewURL(design.id)"
            />
          </DesignCardMenu>
        </template>
        <template v-else>
          <DesignCardMenu
            v-for="design in filteredDesigns"
            :key="design.id"
            :deck="design.sourceFormat === 'deck'"
            :conflicted="design.conflicted"
            @open="openDesign(design)"
            @trash="run(() => moveDesignToTrash(design.id))"
            @download-deck="downloadDeck(design)"
            @keep-copy="resolveConflict(design, 'keep-both')"
            @use-remote="resolveConflict(design, 'use-remote')"
          >
            <DocumentEntry
              v-library-preview="design.id"
              :view="view"
              :name="design.name"
              :metadata="designMetadata(design)"
              :previewURL="previewURL(design.id)"
              :data-format="design.sourceFormat"
              @open="openDesign(design)"
            />
          </DesignCardMenu>
        </template>
      </div>

      <AppPlaceholder
        v-else-if="!normalizedQuery"
        size="compact"
        :fill="false"
        :label="showingTrash ? files.trashEmpty : files.noDesigns"
        :description="showingTrash ? files.trashEmptyDescription : files.noDesignsDescription"
      >
        <template #icon>
          <icon-lucide-trash-2 v-if="showingTrash" />
          <icon-lucide-layout-grid v-else />
        </template>
      </AppPlaceholder>
    </section>
    <AppConfirmationDialog
      v-model:open="deletionOpen"
      :heading="deletion?.heading ?? ''"
      :description="deletion?.description"
      :cancel-label="common.cancel"
      :confirm-label="files.deletePermanently"
      tone="danger"
      @confirm="run(() => emptyTrash(deletion?.ids ?? []))"
    />
  </main>
</template>
