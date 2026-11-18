<script setup lang="ts">
import { useStore } from '@nanostores/vue'
import { ref, shallowRef } from 'vue'

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
/** The open in progress; closing the dialog aborts it, and a newer one replaces it. */
const pending = shallowRef<AbortController | null>(null)

function updateOpen(open: boolean) {
  openURLDialogOpen.value = open
  if (open) return
  pending.value?.abort()
  pending.value = null
  address.value = ''
  invalid.value = null
  error.value = null
}

async function submit() {
  if (pending.value) return
  invalid.value = parseWebAddress(address.value) ? null : files.value.openURLInvalid
  error.value = null
  if (invalid.value) return
  const controller = new AbortController()
  pending.value = controller
  const failure = await submitOpenURL(address.value, controller.signal)
  // An open the dialog was closed on, or that a newer one replaced, no longer speaks for it.
  if (pending.value !== controller) return
  pending.value = null
  if (failure) error.value = failure
  else updateOpen(false)
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
      <AppButton type="submit" color="primary" variant="solid" :loading="pending !== null">
        {{ files.openURLSubmit }}
      </AppButton>
    </template>
  </AppFormDialog>
</template>
