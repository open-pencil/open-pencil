<script setup lang="ts">
import { computed } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue'

import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

import type { PortalServerStatus } from '../types'

/** How the server is set up and what is waiting on an administrator. */
const { status } = defineProps<{ status: PortalServerStatus }>()
const emit = defineEmits<{ open: [section: 'requests' | 'email'] }>()
const messages = useCloudPortalMessages()

const deployment = computed(() =>
  status.deployment === 'official'
    ? messages.value.deploymentOfficial
    : messages.value.deploymentSelfHosted
)
const enrollment = computed(
  () =>
    ({
      open: messages.value.enrollmentOpen,
      approval: messages.value.enrollmentApproval,
      closed: messages.value.enrollmentClosed
    })[status.enrollmentMode]
)
const transport = computed(
  () =>
    ({
      none: messages.value.emailTransportNone,
      smtp: messages.value.emailTransportSMTP,
      cloudflare: messages.value.emailTransportCloudflare
    })[status.emailTransport]
)
const email = computed(() => {
  if (status.failedEmail)
    return messages.value.emailStatus({ failed: status.failedEmail, waiting: status.pendingEmail })
  if (status.pendingEmail) return messages.value.emailWaitingOnly(status.pendingEmail)
  return messages.value.emailAllSent
})
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6">
    <SettingsSection>
      <template #title>{{ messages.needsAttention }}</template>
      <SettingsGroup>
        <SettingsRow
          :label="messages.accessRequests"
          :description="
            status.pendingEnrollment
              ? messages.waitingRequests(status.pendingEnrollment)
              : messages.noOneIsWaiting
          "
        >
          <AppButton
            v-if="status.pendingEnrollment"
            size="sm"
            variant="outline"
            @click="emit('open', 'requests')"
          >
            {{ messages.review }}
          </AppButton>
        </SettingsRow>
        <SettingsRow :label="messages.emailDelivery" :description="email">
          <AppButton
            v-if="status.failedEmail"
            size="sm"
            variant="outline"
            @click="emit('open', 'email')"
          >
            {{ messages.open }}
          </AppButton>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>
    <SettingsSection>
      <template #title>{{ messages.serverSection }}</template>
      <template #description>{{ messages.serverSectionDescription }}</template>
      <SettingsGroup>
        <SettingsRow :label="messages.deployment">
          <span class="text-xs text-muted">{{ deployment }}</span>
        </SettingsRow>
        <SettingsRow :label="messages.newAccounts">
          <span class="text-xs text-muted">{{ enrollment }}</span>
        </SettingsRow>
        <SettingsRow :label="messages.emailDelivery">
          <span class="text-xs text-muted">{{ transport }}</span>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>
  </div>
</template>
