<script setup lang="ts">
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
  account,
  device,
  approving = false
} = defineProps<{
  host: string
  code: string
  account: { name: string; email: string }
  device: string
  approving?: boolean
}>()
const emit = defineEmits<{ approve: []; deny: [] }>()
</script>

<template>
  <PortalPublicLayout
    :host="host"
    heading="Sign in to the OpenPencil app?"
    :description="`${device} asks to use your account, ${account.email}.`"
  >
    <div class="flex flex-col items-center gap-2 rounded-lg bg-input px-4 py-4">
      <span class="text-[11px] text-muted">Check that the app shows this code</span>
      <span class="font-mono text-xl tracking-[0.3em] text-surface">{{ code }}</span>
    </div>
    <AppAlert
      tone="warning"
      heading="Only approve a sign-in you started"
      description="If you didn’t just sign in to OpenPencil on a computer, deny this request."
    />
    <div class="flex items-center justify-end gap-2">
      <AppButton variant="ghost" @click="emit('deny')">Deny</AppButton>
      <AppButton color="primary" variant="solid" :loading="approving" @click="emit('approve')">
        Approve
      </AppButton>
    </div>
  </PortalPublicLayout>
</template>
