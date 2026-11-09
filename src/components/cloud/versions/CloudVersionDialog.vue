<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  DOCUMENT_VERSION_DESCRIPTION_MAX_LENGTH,
  DOCUMENT_VERSION_NAME_MAX_LENGTH
} from '@open-pencil/cloud/contract'
import { useCloudMessages, useCommonMessages } from '@open-pencil/vue/i18n'

import { editVersion, saveVersion } from '@/app/cloud/versions/actions'
import { versionDialog, versionsChanged } from '@/app/cloud/versions/history'
import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import { useHeldContent } from '@/components/ui/overlay/held'

/**
 * Figma's Add to version history: a title and what changed, for the document as it is now, or
 * as Edit version info for a version already in the history.
 */
const t = useCloudMessages()
const common = useCommonMessages()
const name = ref('')
const description = ref('')
const busy = ref(false)
const failed = ref(false)

const open = computed({
  get: () => versionDialog.value !== null,
  set: (value) => {
    if (!value) versionDialog.value = null
  }
})
const shown = useHeldContent(versionDialog)
const editing = computed(() => shown.value?.version ?? null)
const trimmed = computed(() => name.value.trim())

function fill() {
  const dialog = versionDialog.value
  name.value = dialog?.version?.name ?? ''
  description.value = dialog?.version?.description ?? ''
  failed.value = false
}

async function submit() {
  const dialog = versionDialog.value
  if (!dialog || !trimmed.value) return
  busy.value = true
  failed.value = false
  const input = { name: trimmed.value, description: description.value.trim() }
  try {
    if (dialog.version) await editVersion(dialog.store, dialog.version, input)
    else await saveVersion(dialog.store, input)
    versionsChanged(dialog.store)
    versionDialog.value = null
  } catch (error) {
    console.warn('[Cloud] Saving to the version history failed:', error)
    failed.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AppFormDialog
    v-model:open="open"
    :heading="editing ? t.editVersionInfo : t.addToVersionHistory"
    :close-label="common.close"
    :cancel-label="common.cancel"
    :submit-label="common.save"
    :error="failed ? t.versionChangeFailed : null"
    :saving="busy"
    :submit-disabled="!trimmed"
    @open="fill"
    @submit="submit"
  >
    <AppFormField :label="t.versionTitle" label-hidden>
      <template #default="{ id }">
        <AppInput
          :id="id"
          v-model="name"
          autofocus
          :maxlength="DOCUMENT_VERSION_NAME_MAX_LENGTH"
          :disabled="busy"
          :placeholder="t.versionTitle"
        />
      </template>
    </AppFormField>
    <AppFormField :label="t.versionDescription" label-hidden>
      <template #default="{ id }">
        <AppTextarea
          :id="id"
          v-model="description"
          :maxlength="DOCUMENT_VERSION_DESCRIPTION_MAX_LENGTH"
          :disabled="busy"
          :placeholder="t.versionDescription"
        />
      </template>
    </AppFormField>
  </AppFormDialog>
</template>
