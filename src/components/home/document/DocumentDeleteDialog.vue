<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'

import { useCommonMessages, useFileMessages } from '@open-pencil/vue/i18n'

import type { StorageDocument, StorageLocation } from '@/app/integrations/storage'
import { toast } from '@/app/shell/ui'
import { deleteStoredDocument } from '@/app/storage/workspace/delete'
import { AppConfirmationDialog } from '@/components/ui/dialog'

/** Asks before a stored document is deleted for everyone who can open it. */
const { location } = defineProps<{ location: StorageLocation }>()
/** The document to ask about; set it to ask, and it is cleared once the dialog closes. */
const document = defineModel<StorageDocument | null>('document', { default: null })
const files = useFileMessages()
const common = useCommonMessages()

// The dialog closes itself before it confirms, and keeps its heading while it animates closed,
// so it holds the document it was asked about apart from the model.
const open = ref(false)
const target = shallowRef<StorageDocument | null>(null)
watch(
  document,
  (next) => {
    if (!next) return
    target.value = next
    open.value = true
  },
  { immediate: true }
)
watch(open, (value) => {
  if (!value) document.value = null
})

function confirm() {
  const deleting = target.value
  if (!deleting) return
  void deleteStoredDocument(deleting, location).catch((error: unknown) => {
    console.error('[Storage] Deleting a document failed:', error)
    toast.error(files.value.deleteDocumentFailed({ name: deleting.name }))
  })
}
</script>

<template>
  <AppConfirmationDialog
    v-model:open="open"
    :heading="files.deleteDocumentConfirmation({ name: target?.name ?? '' })"
    :description="files.deleteDocumentDescription"
    :cancel-label="common.cancel"
    :confirm-label="files.deleteDocument"
    tone="danger"
    @confirm="confirm"
  />
</template>
