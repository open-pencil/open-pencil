<script setup lang="ts">
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { portalForm } from '@/components/cloud-portal/ui'
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
  deciding = false,
  error = null
} = defineProps<{
  host: string
  code: string
  /** The signed-in account the app would use. */
  email: string
  deciding?: boolean
  /** Why the last approval or denial didn't go through; the person can try again. */
  error?: string | null
}>()
const emit = defineEmits<{ approve: []; deny: [] }>()
const messages = useCloudPortalMessages()
const ui = portalForm({ size: 'lg' })
</script>

<template>
  <PortalPublicLayout
    :host="host"
    :heading="messages.deviceTitle"
    :description="messages.deviceDescription({ email })"
  >
    <div class="flex flex-col items-center gap-2 rounded-lg border border-border px-4 py-4">
      <span class="text-xs text-muted">{{ messages.deviceCheckCode }}</span>
      <span class="font-mono text-xl tracking-[0.3em] text-surface">{{ code }}</span>
    </div>
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <AppAlert
      tone="warning"
      :heading="messages.deviceWarningTitle"
      :description="messages.deviceWarningDescription"
    />
    <div :class="ui.methods()">
      <AppButton
        size="lg"
        color="primary"
        variant="solid"
        :class="ui.submit()"
        :loading="deciding"
        @click="emit('approve')"
      >
        {{ messages.approve }}
      </AppButton>
      <AppButton
        size="lg"
        variant="outline"
        :class="ui.submit()"
        :disabled="deciding"
        @click="emit('deny')"
      >
        {{ messages.deny }}
      </AppButton>
    </div>
  </PortalPublicLayout>
</template>
