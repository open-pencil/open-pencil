<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { usePortalAction } from '@/app/cloud-portal/state'
import PortalDeviceApproval from '@/components/cloud-portal/auth/PortalDeviceApproval.vue'
import PortalNotice from '@/components/cloud-portal/auth/PortalNotice.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

const portal = usePortal()
const route = useRoute()
const router = useRouter()
const messages = useCloudPortalMessages()
const { failure } = usePortalFailureMessages()
const code = computed(() =>
  typeof route.query.user_code === 'string' ? route.query.user_code.trim().toUpperCase() : ''
)
const state = ref<'checking' | 'pending' | 'approved' | 'denied' | 'expired'>('checking')

onMounted(async () => {
  if (!code.value) {
    state.value = 'expired'
    return
  }
  const result = await portal.auth.deviceRequest(code.value)
  state.value = result.ok ? result.value : 'expired'
})

const {
  busy: deciding,
  error,
  run: decide,
  fail
} = usePortalAction(async (decision: 'approve' | 'deny') => {
  const result = await portal.auth.decideDevice(code.value, decision)
  if (result.ok) state.value = decision === 'approve' ? 'approved' : 'denied'
  // Only a refused code ends the approval; anything else leaves it to try again.
  else if (result.failure === 'invalid-code') state.value = 'expired'
  else fail(failure(result.failure))
})
</script>

<template>
  <PortalDeviceApproval
    v-if="state === 'pending' && portal.account.value"
    :host="portal.host"
    :code="code"
    :email="portal.account.value.user.email"
    :deciding="deciding"
    :error="error"
    @approve="decide('approve')"
    @deny="decide('deny')"
  />
  <PortalNotice
    v-else-if="state === 'approved'"
    :host="portal.host"
    tone="success"
    :heading="messages.deviceApprovedTitle"
    :description="messages.deviceApprovedDescription"
  >
    <template #icon><icon-lucide-check class="size-6" /></template>
  </PortalNotice>
  <PortalNotice
    v-else-if="state === 'denied'"
    :host="portal.host"
    :heading="messages.deviceDeniedTitle"
    :description="messages.deviceDeniedDescription"
  >
    <template #icon><icon-lucide-monitor-x class="size-6" /></template>
    <template #actions>
      <AppButton
        size="lg"
        variant="outline"
        class="w-full"
        @click="router.push({ name: 'security' })"
      >
        {{ messages.accountSettings }}
      </AppButton>
    </template>
  </PortalNotice>
  <PortalNotice
    v-else-if="state === 'expired'"
    :host="portal.host"
    :heading="messages.deviceExpiredTitle"
    :description="messages.deviceExpiredDescription"
  >
    <template #icon><icon-lucide-timer-off class="size-6" /></template>
  </PortalNotice>
</template>
