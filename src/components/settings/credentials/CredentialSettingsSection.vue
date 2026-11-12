<script setup lang="ts">
import { IS_TAURI } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue/i18n'

import { useCredentialSettings } from '@/app/settings/credentials/preferences/use'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { credentials } = useI18n()
const { busy, paused, failed, checkFailed, remembered, retry, retryCheck } = useCredentialSettings()
</script>

<template>
  <SettingsSection v-if="!IS_TAURI || paused || failed || checkFailed">
    <template #title>{{ credentials.settingsTitle }}</template>
    <SettingsGroup v-if="!IS_TAURI">
      <SettingsRow
        as="label"
        :label="credentials.rememberDevice"
        :description="!remembered ? credentials.sessionOnly : undefined"
      >
        <AppSwitch v-model="remembered" :label="credentials.rememberDevice" />
      </SettingsRow>
    </SettingsGroup>
    <AppAlert v-if="checkFailed" tone="warning" :heading="credentials.checkFailed">
      <template #actions>
        <AppButton size="xs" variant="outline" :disabled="busy" @click="retryCheck">{{
          credentials.retryCheck
        }}</AppButton>
      </template>
    </AppAlert>
    <AppAlert v-else-if="paused" tone="warning" :heading="credentials.accessPaused">
      <template #actions>
        <AppButton size="xs" variant="outline" :disabled="busy" @click="retry">{{
          credentials.retryAccess
        }}</AppButton>
      </template>
    </AppAlert>
    <AppAlert v-if="failed" tone="error" :heading="credentials.retryFailed" />
  </SettingsSection>
</template>
