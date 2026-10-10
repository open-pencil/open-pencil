<script setup lang="ts">
import { useCloudPortalMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalPublicLayout from '../layout/PortalPublicLayout.vue'

/**
 * Approving a sign-in started in the desktop app: the person checks that the code matches the
 * one the app shows, then lets the app use their account.
 */
const {
  host,
  code,
  email,
  deciding = false
} = defineProps<{
  host: string
  code: string
  /** The signed-in account the app would use. */
  email: string
  deciding?: boolean
}>()
const emit = defineEmits<{ approve: []; deny: [] }>()
const messages = useCloudPortalMessages()
</script>

<template>
  <PortalPublicLayout
    :host="host"
    :heading="messages.deviceTitle"
    :description="messages.deviceDescription({ email })"
  >
    <div class="flex flex-col items-center gap-2 rounded-lg bg-input px-4 py-4">
      <span class="text-[11px] text-muted">{{ messages.deviceCheckCode }}</span>
      <span class="font-mono text-xl tracking-[0.3em] text-surface">{{ code }}</span>
    </div>
    <AppAlert
      tone="warning"
      :heading="messages.deviceWarningTitle"
      :description="messages.deviceWarningDescription"
    />
    <div class="flex items-center justify-end gap-2">
      <AppButton variant="ghost" :disabled="deciding" @click="emit('deny')">
        {{ messages.deny }}
      </AppButton>
      <AppButton color="primary" variant="solid" :loading="deciding" @click="emit('approve')">
        {{ messages.approve }}
      </AppButton>
    </div>
  </PortalPublicLayout>
</template>
