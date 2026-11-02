<script setup lang="ts">
import { useI18n } from '@open-pencil/vue/i18n'

import { useSharingSettings } from '@/app/telemetry/settings'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
import { PRIVACY_URL } from '@/constants'

const { diagnostics } = useI18n()
const { dailyPing, usageStats, unofficialBuild, disabledByEnvironment } = useSharingSettings()
</script>

<template>
  <SettingsSection data-test-id="settings-privacy-panel">
    <template #title>{{ diagnostics.sharingTitle }}</template>
    <template #description>{{ diagnostics.sharingDescription }}</template>
    <template #actions>
      <SettingsLink :href="PRIVACY_URL">{{ diagnostics.sharingDetails }}</SettingsLink>
    </template>
    <AppAlert v-if="unofficialBuild" :heading="diagnostics.sharingUnofficialBuild" />
    <AppAlert
      v-else-if="disabledByEnvironment"
      :heading="diagnostics.sharingDisabledByEnvironment"
    />
    <SettingsGroup>
      <SettingsRow
        :label="diagnostics.sharingPing"
        :description="diagnostics.sharingPingDescription"
      >
        <AppSwitch v-model="dailyPing" :label="diagnostics.sharingPing" />
      </SettingsRow>
      <SettingsRow
        :label="diagnostics.sharingUsageStats"
        :description="diagnostics.sharingUsageStatsDescription"
      >
        <AppSwitch v-model="usageStats" :label="diagnostics.sharingUsageStats" />
      </SettingsRow>
    </SettingsGroup>
    <p class="text-[11px] text-muted">{{ diagnostics.sharingLocalData }}</p>
  </SettingsSection>
</template>
