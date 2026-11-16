<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { cloudCommunityPagePath, type CommunityDocument } from '@open-pencil/cloud/contract'
import { useViewportKind } from '@open-pencil/vue/editor/viewport-kind'
import { useCloudPortalMessages, useFileMessages, usePanelMessages } from '@open-pencil/vue/i18n'

import { useCommunityDocuments } from '@/app/cloud-portal/community'
import { usePortal } from '@/app/cloud-portal/context'
import { useDateFormat } from '@/app/i18n/date'
import CommunityLayout from '@/components/cloud-portal/community/CommunityLayout.vue'
import PortalLoadAlert from '@/components/cloud-portal/layout/PortalLoadAlert.vue'
import DocumentEntry from '@/components/home/document/DocumentEntry.vue'
import { ofKind, type DocumentKindFilter } from '@/components/home/document/filter'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

/**
 * The server's community gallery, laid out as Home's files: a search, the file type and grid or
 * list, and each file as Home shows one, newest change first.
 */
const portal = usePortal()
const router = useRouter()
const messages = useCloudPortalMessages()
const files = useFileMessages()
const panels = usePanelMessages()
const dates = useDateFormat()
const { isTouch } = useViewportKind()
const { state, reload } = useCommunityDocuments(portal.discovery)

const query = ref('')
const kind = ref<DocumentKindFilter>('all')
const view = ref<'grid' | 'list'>('grid')
const kindOptions = computed(() => [
  { value: 'all', label: files.value.allFiles },
  { value: 'design', label: files.value.createDesign },
  { value: 'board', label: files.value.createBoard }
])

const documents = computed(() => (state.value.status === 'ready' ? state.value.documents : []))
const shown = computed(() => {
  const words = query.value.trim().toLocaleLowerCase()
  return documents.value.filter(
    (entry) =>
      ofKind(entry.kind, kind.value) && (!words || entry.name.toLocaleLowerCase().includes(words))
  )
})

/** The newest named version, such as the release it was published for, and the last change. */
function metadata(document: CommunityDocument): string {
  const date = dates.format(document.updatedAt, 'date')
  const version = document.versions[0]?.name
  return version ? `${version} · ${date}` : date
}

function open(document: CommunityDocument) {
  void router.push(cloudCommunityPagePath(document.id))
}

useHead({ title: () => messages.value.communityTitle })
</script>

<template>
  <CommunityLayout>
    <AppInput
      v-model="query"
      type="search"
      name="community-search"
      autocomplete="off"
      class="mb-4 md:mb-6"
      size="md"
      :density="isTouch ? 'comfortable' : 'compact'"
      :placeholder="files.searchFiles"
      :aria-label="files.searchFiles"
    >
      <template #leading><icon-lucide-search class="size-4" /></template>
    </AppInput>

    <section>
      <div class="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
        <div class="col-span-2 min-w-0 sm:col-span-1">
          <h1 class="text-base font-semibold">{{ messages.communityTitle }}</h1>
          <p class="mt-0.5 text-pretty text-xs text-muted">{{ messages.communityDescription }}</p>
        </div>
        <div class="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
          <AppSelect v-model="kind" :label="files.fileKind" :options="kindOptions" class="w-28" />
          <SegmentedControl
            v-model="view"
            required
            :label="messages.communityTitle"
            :size="isTouch ? 'touch' : 'md'"
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

      <PortalLoadAlert v-if="state.status === 'failed'" :error="state.error" @retry="reload" />

      <div
        v-else-if="state.status === 'loading'"
        class="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))]"
      >
        <span role="status" class="sr-only">{{ messages.loading }}</span>
        <div v-for="index in 6" :key="index" class="flex flex-col gap-2" aria-hidden="true">
          <AppSkeleton class="aspect-[4/3] w-full rounded-lg" />
          <AppSkeleton class="w-32" />
          <AppSkeleton class="w-20" />
        </div>
      </div>

      <div
        v-else-if="shown.length && view === 'grid'"
        class="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))]"
      >
        <DocumentEntry
          v-for="document in shown"
          :key="document.id"
          :name="document.name"
          :kind="document.kind"
          :metadata="metadata(document)"
          :previewURL="document.thumbnailPath"
          @open="open(document)"
        />
      </div>

      <div v-else-if="shown.length" class="overflow-hidden rounded-lg border border-border">
        <DocumentEntry
          v-for="document in shown"
          :key="document.id"
          view="list"
          :name="document.name"
          :kind="document.kind"
          :metadata="metadata(document)"
          @open="open(document)"
        />
      </div>

      <p
        v-else
        class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted"
      >
        {{
          query.trim()
            ? files.noMatchingFiles({ query: query.trim() })
            : documents.length === 0
              ? messages.communityEmpty
              : kind === 'board'
                ? messages.communityNoBoards
                : messages.communityNoDesigns
        }}
      </p>
    </section>
  </CommunityLayout>
</template>
