<script setup lang="ts">
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

/** How the server is set up and what is waiting on an administrator. */
const { status } = defineProps<{
  status: {
    version: string
    enrollment: string
    email: string
    waitingRequests: number
    waitingEmails: number
    failedEmails: number
  }
}>()
const emit = defineEmits<{ open: [section: 'requests' | 'email'] }>()
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6">
    <SettingsSection>
      <template #title>Needs attention</template>
      <SettingsGroup>
        <SettingsRow
          label="Access requests"
          :description="
            status.waitingRequests
              ? `${status.waitingRequests} people are waiting for a decision`
              : 'No one is waiting'
          "
        >
          <AppButton
            v-if="status.waitingRequests"
            size="sm"
            variant="outline"
            @click="emit('open', 'requests')"
          >
            Review
          </AppButton>
        </SettingsRow>
        <SettingsRow
          label="Email"
          :description="
            status.failedEmails
              ? `${status.failedEmails} failed to send · ${status.waitingEmails} waiting`
              : `${status.waitingEmails} waiting to send`
          "
        >
          <AppButton
            v-if="status.failedEmails"
            size="sm"
            variant="outline"
            @click="emit('open', 'email')"
          >
            Open
          </AppButton>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>
    <SettingsSection>
      <template #title>Server</template>
      <template #description>Set in the server’s configuration file.</template>
      <SettingsGroup>
        <SettingsRow label="Version"
          ><span class="text-xs text-muted">{{ status.version }}</span></SettingsRow
        >
        <SettingsRow label="New accounts"
          ><span class="text-xs text-muted">{{ status.enrollment }}</span></SettingsRow
        >
        <SettingsRow label="Email delivery"
          ><span class="text-xs text-muted">{{ status.email }}</span></SettingsRow
        >
      </SettingsGroup>
    </SettingsSection>
  </div>
</template>
