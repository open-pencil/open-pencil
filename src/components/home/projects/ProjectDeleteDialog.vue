<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'

import { useCommonMessages, useProjectMessages } from '@open-pencil/vue/i18n'

import type { Project } from '@/app/projects/schema'
import { AppConfirmationDialog } from '@/components/ui/dialog'

/**
 * Asks before a project leaves the list. The repository is untouched: only the record that makes
 * Home list it goes away, so this is a confirmation and not a delete.
 */
const project = defineModel<Project | null>('project', { default: null })
const emit = defineEmits<{ confirm: [id: string] }>()
const labels = useProjectMessages()
const common = useCommonMessages()

// The dialog closes itself before it confirms, and keeps its heading while it animates closed,
// so it holds the project it was asked about apart from the model.
const open = ref(false)
const target = shallowRef<Project | null>(null)
watch(
  project,
  (next) => {
    if (!next) return
    target.value = next
    open.value = true
  },
  { immediate: true }
)
watch(open, (value) => {
  if (!value) project.value = null
})

function confirm() {
  const removing = target.value
  if (removing) emit('confirm', removing.id)
}
</script>

<template>
  <AppConfirmationDialog
    v-model:open="open"
    :heading="labels.removeConfirmation({ name: target?.name ?? '' })"
    :description="labels.removeDescription"
    :cancel-label="common.cancel"
    :confirm-label="labels.removeConfirm"
    tone="danger"
    @confirm="confirm"
  />
</template>
