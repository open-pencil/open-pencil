<script setup lang="ts">
import { useStore } from '@nanostores/vue'
import { ref } from 'vue'

import { filesMessages } from '@open-pencil/vue/i18n'

import { openURLDialogOpen, submitOpenURL } from '@/app/document/io/url/dialog'
import { parseWebAddress } from '@/app/document/io/url/open'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogCancel from '@/components/ui/dialog/AppDialogCancel.vue'
import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { IS_TAURI } from '@/constants'

/**
 * File → Open from URL…: a web address to open, which a page opens from as editable layers, and
 * an image, an SVG, or a design file as it would from the computer.
 */
const files = useStore(filesMessages)
const address = ref('')
const invalid = ref<string | null>(null)
const error = ref<string | null>(null)
const opening = ref(false)

function updateOpen(open: boolean) {
  openURLDialogOpen.value = open
  if (open) return
  address.value = ''
  invalid.value = null
  error.value = null
}

async function submit() {
  if (opening.value) return
  invalid.value = parseWebAddress(address.value) ? null : files.value.openURLInvalid
  error.value = null
  if (invalid.value) return
  opening.value = true
  try {
    error.value = await submitOpenURL(address.value)
    if (!error.value) updateOpen(false)
  } finally {
    opening.value = false
  }
}
</script>

<template>
  <AppFormDialog
    :open="openURLDialogOpen"
    :heading="files.openURLHeading"
    :description="IS_TAURI ? files.openURLDescription : files.openURLDescriptionBrowser"
    :error="error"
    :error-heading="files.openURLFailed"
    @update:open="updateOpen"
    @submit="submit"
  >
    <AppFormField :label="files.openURLAddress" :error="invalid">
      <template #default="{ id, invalid: hasError, describedBy }">
        <AppInput
          :id="id"
          v-model="address"
          type="url"
          inputmode="url"
          autocomplete="url"
          autofocus
          placeholder="https://example.com"
          :state="hasError ? 'invalid' : 'idle'"
          :aria-invalid="hasError || undefined"
          :aria-describedby="describedBy"
        />
      </template>
    </AppFormField>
    <template #footer>
      <AppDialogCancel />
      <AppButton type="submit" color="primary" variant="solid" :loading="opening">
        {{ files.openURLSubmit }}
      </AppButton>
    </template>
  </AppFormDialog>
</template>
