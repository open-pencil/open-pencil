<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'

import {
  DOCUMENT_VERSION_DESCRIPTION_MAX_LENGTH,
  DOCUMENT_VERSION_NAME_MAX_LENGTH
} from '@open-pencil/cloud/contract'
import { useCloudMessages, useCommonMessages } from '@open-pencil/vue/i18n'

import { editVersion, saveVersion } from '@/app/cloud/versions/actions'
import {
  versionDialog,
  versionDraft,
  versionsChanged,
  type VersionDialog
} from '@/app/cloud/versions/history'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogCancel from '@/components/ui/dialog/AppDialogCancel.vue'
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
const busy = ref(false)
/** The opening whose save failed; a new opening is another object, so it starts without the alert. */
const failedFor = shallowRef<VersionDialog | null>(null)

const open = computed({
  get: () => versionDialog.value !== null,
  set: (value) => {
    if (!value) versionDialog.value = null
  }
})
const shown = useHeldContent(versionDialog)
const editing = computed(() => shown.value?.version ?? null)
const trimmed = computed(() => versionDraft.value.name.trim())

async function submit() {
  const dialog = versionDialog.value
  if (!dialog) return
  busy.value = true
  failedFor.value = null
  const input = { name: trimmed.value, description: versionDraft.value.description.trim() }
  try {
    if (dialog.version) await editVersion(dialog.store, dialog.version, input)
    else await saveVersion(dialog.store, input)
    versionsChanged(dialog.store)
    versionDialog.value = null
  } catch (error) {
    console.warn('[Cloud] Saving to the version history failed:', error)
    failedFor.value = dialog
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AppFormDialog
    v-model:open="open"
    :heading="editing ? t.editVersionInfo : t.addToVersionHistory"
    :error="failedFor !== null && failedFor === shown ? t.versionChangeFailed : null"
    @submit="submit"
  >
    <AppFormField :label="t.versionTitle" label-hidden>
      <template #default="{ id }">
        <AppInput
          :id="id"
          v-model="versionDraft.name"
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
          v-model="versionDraft.description"
          :maxlength="DOCUMENT_VERSION_DESCRIPTION_MAX_LENGTH"
          :disabled="busy"
          :placeholder="t.versionDescription"
        />
      </template>
    </AppFormField>
    <template #footer>
      <AppDialogCancel />
      <AppButton type="submit" color="primary" variant="solid" :loading="busy" :disabled="!trimmed">
        {{ common.save }}
      </AppButton>
    </template>
  </AppFormDialog>
</template>
