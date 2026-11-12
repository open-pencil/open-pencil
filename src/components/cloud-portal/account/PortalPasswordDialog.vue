<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogCancel from '@/components/ui/dialog/AppDialogCancel.vue'
import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'

import PortalPasswordDialogFields from './PortalPasswordDialogFields.vue'

/**
 * Asks for passwords: the current one to confirm a sensitive change, and a new one when the
 * change is the password itself.
 */
const {
  purpose,
  minimumPasswordLength = 8,
  error = null,
  saving = false
} = defineProps<{
  purpose: 'confirm' | 'change'
  minimumPasswordLength?: number
  error?: string | null
  saving?: boolean
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [passwords: { current: string; next: string }] }>()

const messages = useCloudPortalMessages()
const fields = useTemplateRef('fields')
</script>

<template>
  <AppFormDialog
    v-model:open="open"
    :heading="purpose === 'change' ? messages.changePasswordTitle : messages.confirmPasswordTitle"
    :error="error"
    :error-heading="messages.errorTitle"
    @submit="fields?.submit()"
  >
    <PortalPasswordDialogFields
      ref="fields"
      :purpose="purpose"
      :minimum-password-length="minimumPasswordLength"
      @submit="emit('submit', $event)"
    />
    <template #footer>
      <AppDialogCancel />
      <AppButton type="submit" color="primary" variant="solid" :loading="saving">
        {{ purpose === 'change' ? messages.savePassword : messages.continue }}
      </AppButton>
    </template>
  </AppFormDialog>
</template>
