<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  DOCUMENT_VERSION_DESCRIPTION_MAX_LENGTH,
  DOCUMENT_VERSION_NAME_MAX_LENGTH
} from '@open-pencil/cloud/contract'
import { useCloudMessages, useCommonMessages } from '@open-pencil/vue/i18n'

import { editVersion, saveVersion } from '@/app/cloud/versions/actions'
import { versionDialog, versionsChanged } from '@/app/cloud/versions/history'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import { useHeldContent } from '@/components/ui/overlay/held'

import { cloudVersions } from './ui'

/**
 * Figma's Add to version history: a title and what changed, for the document as it is now, or
 * as Edit version info for a version already in the history.
 */
const t = useCloudMessages()
const common = useCommonMessages()
const ui = cloudVersions()
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

// Filled as it opens: clearing as it closes would empty the fields during its exit animation.
watch(versionDialog, (dialog) => {
  if (!dialog) return
  name.value = dialog.version?.name ?? ''
  description.value = dialog.version?.description ?? ''
  failed.value = false
})

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
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader
      :heading="editing ? t.editVersionInfo : t.addToVersionHistory"
      :close-label="common.close"
    />
    <AppDialogBody>
      <form id="cloud-version" :class="ui.form()" novalidate @submit.prevent="submit">
        <label for="cloud-version-title" :class="ui.label()">{{ t.versionTitle }}</label>
        <AppInput
          id="cloud-version-title"
          v-model="name"
          autofocus
          :maxlength="DOCUMENT_VERSION_NAME_MAX_LENGTH"
          :disabled="busy"
          :placeholder="t.versionTitle"
        />
        <label for="cloud-version-description" :class="ui.label()">
          {{ t.versionDescription }}
        </label>
        <AppTextarea
          id="cloud-version-description"
          v-model="description"
          :maxlength="DOCUMENT_VERSION_DESCRIPTION_MAX_LENGTH"
          :disabled="busy"
          :placeholder="t.versionDescription"
        />
        <AppAlert v-if="failed" tone="error" :heading="t.versionChangeFailed" />
      </form>
    </AppDialogBody>
    <AppDialogFooter>
      <AppButton @click="open = false">{{ common.cancel }}</AppButton>
      <AppButton
        type="submit"
        form="cloud-version"
        color="primary"
        variant="solid"
        :loading="busy"
        :disabled="!trimmed"
      >
        {{ common.save }}
      </AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
