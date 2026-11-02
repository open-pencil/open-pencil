<script setup lang="ts">
import { IS_TAURI } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue/i18n'

import {
  browserNotificationPermission,
  requestBrowserNotificationPermission
} from '@/app/shell/notifications/permission'
import { notificationPreference } from '@/app/shell/notifications/preferences'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { ai, settings } = useI18n()
const needsInput = notificationPreference('agentNeedsInput')
const finished = notificationPreference('agentFinished')
const failed = notificationPreference('agentFailed')
</script>

<template>
  <SettingsSection data-test-id="settings-notifications">
    <template #title>{{ settings.notifications }}</template>
    <template #description>{{
      IS_TAURI ? `${ai.notificationsHint} ${ai.notificationsSystemHint}` : ai.notificationsHint
    }}</template>
    <SettingsGroup>
      <SettingsRow
        v-if="browserNotificationPermission === 'default'"
        :label="ai.notificationsAllow"
        :description="ai.notificationsAllowHint"
      >
        <AppButton
          size="xs"
          variant="outline"
          data-test-id="settings-notifications-allow"
          @click="requestBrowserNotificationPermission()"
          >{{ ai.notificationsAllow }}</AppButton
        >
      </SettingsRow>
      <SettingsRow :label="ai.notifyNeedsInput" :description="ai.notifyNeedsInputHint">
        <AppSwitch v-model="needsInput" :label="ai.notifyNeedsInput" />
      </SettingsRow>
      <SettingsRow :label="ai.notifyFinished">
        <AppSwitch v-model="finished" :label="ai.notifyFinished" />
      </SettingsRow>
      <SettingsRow :label="ai.notifyFailed">
        <AppSwitch v-model="failed" :label="ai.notifyFailed" />
      </SettingsRow>
    </SettingsGroup>
    <AppAlert
      v-if="browserNotificationPermission === 'denied'"
      tone="warning"
      :heading="ai.notificationsBlocked"
    />
    <AppAlert
      v-else-if="browserNotificationPermission === 'unsupported'"
      :heading="ai.notificationsUnsupported"
    />
  </SettingsSection>
</template>
