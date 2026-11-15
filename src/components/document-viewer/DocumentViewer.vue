<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { useReadOnlyDocument } from '@/app/document-viewer'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import DocumentCanvas from './DocumentCanvas.vue'

/**
 * A document open read-only in a dialog: its pages, panned and zoomed as in the editor, with
 * nothing that edits it. Mounted lazily, it brings the editor with it only when opened.
 */
const { url, name = 'document.fig' } = defineProps<{ url: string; name?: string }>()
const open = defineModel<boolean>('open', { default: true })

const { store, status, pages, open: load } = useReadOnlyDocument(url, name)
onMounted(() => void load())

const pageOptions = computed(() =>
  pages.value.map((page) => ({ value: page.id, label: page.name || 'Untitled page' }))
)
const page = computed({
  get: () => store.state.currentPageId,
  set: (id: string) => void store.switchPage(id)
})
</script>

<template>
  <AppDialogRoot v-model:open="open" size="screen" height="screen">
    <AppDialogHeader :heading="name" description="Read-only. Nothing here edits the file.">
      <template v-if="pageOptions.length > 1" #actions>
        <AppSelect
          v-model="page"
          label="Page"
          :options="pageOptions"
          size="sm"
          :ui="{ trigger: 'w-48' }"
        />
      </template>
    </AppDialogHeader>
    <div class="flex min-h-0 flex-1">
      <AppPlaceholder
        v-if="status === 'failed'"
        label="The document could not open"
        description="It may have been deleted, or the editor could not read it."
      >
        <template #icon><icon-lucide-file-x class="size-5" /></template>
      </AppPlaceholder>
      <DocumentCanvas v-else />
    </div>
  </AppDialogRoot>
</template>
