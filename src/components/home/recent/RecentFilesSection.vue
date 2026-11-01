<script setup lang="ts">
import { computed } from 'vue'

import { useViewportKind } from '@open-pencil/vue/editor/viewport-kind'
import { useI18n } from '@open-pencil/vue/i18n'

import { useDateFormat } from '@/app/i18n/date'
import { clearRecentFiles, recentDocumentKind, type RecentDocument } from '@/app/recent-files'
import type { RecentFilesWorkspace } from '@/app/recent-files/workspace'
import DocumentEntry from '@/components/home/document/DocumentEntry.vue'
import type { DocumentKindFilter } from '@/components/home/document/filter'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

/** The recent files, as a grid or a list, with the files `documents` keeps of them. */
const { workspace, documents, query } = defineProps<{
  workspace: RecentFilesWorkspace
  documents: readonly RecentDocument[]
  query: string
}>()
const emit = defineEmits<{ open: [document: RecentDocument] }>()
const view = defineModel<'grid' | 'list'>('view', { required: true })
const kind = defineModel<DocumentKindFilter>('kind', { required: true })
const kindOptions = computed(() => [
  { value: 'all', label: files.value.allFiles },
  { value: 'design', label: files.value.createDesign },
  { value: 'board', label: files.value.createBoard }
])
const { panels, files, common } = useI18n()
const { isTouch } = useViewportKind()
const dates = useDateFormat()
const previewURL = workspace.previewURL
const vWorkspacePreview = workspace.previewDirective
const hasRecentFiles = computed(() => workspace.documents.value.length > 0)

/** A file's last change; a file that never reported one shows nothing. */
function formattedDate(updatedAt: string): string {
  return Date.parse(updatedAt) === 0 ? '' : dates.format(updatedAt, 'dateTime')
}
</script>

<template>
  <section>
    <div class="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
      <div class="col-span-2 min-w-0 sm:col-span-1">
        <h1 class="text-base font-semibold">{{ files.recentFiles }}</h1>
        <p class="mt-0.5 text-pretty text-xs text-muted">{{ files.recentFilesDescription }}</p>
      </div>
      <div class="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
        <IconButton
          v-if="hasRecentFiles"
          :label="common.clear"
          class="size-10 sm:size-7"
          data-test-id="recent-files-clear"
          @click="clearRecentFiles"
        >
          <icon-lucide-trash-2 class="size-3.5" />
        </IconButton>
        <AppSelect
          v-model="kind"
          :label="files.fileKind"
          :options="kindOptions"
          class="w-28"
          data-test-id="home-files-kind"
        />
        <SegmentedControl
          v-model="view"
          required
          :label="files.recentFiles"
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

    <div
      v-if="documents.length && view === 'grid'"
      class="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
    >
      <DocumentEntry
        v-for="document in documents"
        :key="document.id"
        v-workspace-preview="document.id"
        :name="document.name"
        :kind="recentDocumentKind(document)"
        :metadata="formattedDate(document.updatedAt)"
        :previewURL="previewURL(document.id)"
        @open="emit('open', document)"
      />
    </div>

    <div v-else-if="documents.length" class="overflow-hidden rounded-lg border border-border">
      <DocumentEntry
        v-for="document in documents"
        :key="document.id"
        view="list"
        :name="document.name"
        :kind="recentDocumentKind(document)"
        :metadata="formattedDate(document.updatedAt)"
        @open="emit('open', document)"
      />
    </div>

    <div
      v-else-if="!query && !hasRecentFiles"
      class="rounded-lg border border-dashed border-border px-4 py-4 text-center sm:py-6"
    >
      <p class="text-xs font-medium">{{ files.noRecentFiles }}</p>
      <p class="mt-1 text-xs text-muted">{{ files.noRecentFilesDescription }}</p>
    </div>

    <!-- Recent files are all of another kind than the filter shows. -->
    <p
      v-else-if="!query"
      class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted"
    >
      {{ kind === 'board' ? files.noRecentBoards : files.noRecentDesigns }}
    </p>

    <!-- The search matches files of another kind only. -->
    <p
      v-else
      class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted"
    >
      {{ files.noMatchingFiles({ query }) }}
    </p>
  </section>
</template>
