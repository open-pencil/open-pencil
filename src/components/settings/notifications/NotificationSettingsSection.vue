<script setup lang="ts">
import { IS_TAURI } from '@open-pencil/core/constants'
import { useMessages } from '@open-pencil/vue/i18n'

import { CLOUD_INCLUDED } from '@/app/cloud/integration'
import { useNotificationMessages } from '@/app/i18n/notifications'
import { DEFAULT_APP_PREFERENCES } from '@/app/settings/preferences/store'
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

const ai = useMessages('ai')
const settings = useMessages('settings')
const comments = useMessages('comments')
const cloud = useMessages('cloud/editor')
const notifications = useNotificationMessages()
const needsInput = notificationPreference('agentNeedsInput')
const finished = notificationPreference('agentFinished')
const failed = notificationPreference('agentFailed')
const mention = notificationPreference('commentMention')
const reply = notificationPreference('commentReply')
const saveFailed = notificationPreference('saveFailed')
const cloudConflict = notificationPreference('cloudConflict')
const cloudStorageFull = notificationPreference('cloudStorageFull')
const defaults = DEFAULT_APP_PREFERENCES.notifications
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
      <SettingsRow
        :label="ai.notifyNeedsInput"
        :description="ai.notifyNeedsInputHint"
        :modified="needsInput !== defaults.agentNeedsInput"
        @reset="needsInput = defaults.agentNeedsInput"
      >
        <AppSwitch v-model="needsInput" :label="ai.notifyNeedsInput" />
      </SettingsRow>
      <SettingsRow
        :label="ai.notifyFinished"
        :modified="finished !== defaults.agentFinished"
        @reset="finished = defaults.agentFinished"
      >
        <AppSwitch v-model="finished" :label="ai.notifyFinished" />
      </SettingsRow>
      <SettingsRow
        :label="ai.notifyFailed"
        :modified="failed !== defaults.agentFailed"
        @reset="failed = defaults.agentFailed"
      >
        <AppSwitch v-model="failed" :label="ai.notifyFailed" />
      </SettingsRow>
      <SettingsRow
        :label="comments.notifyMention"
        :modified="mention !== defaults.commentMention"
        @reset="mention = defaults.commentMention"
      >
        <AppSwitch v-model="mention" :label="comments.notifyMention" />
      </SettingsRow>
      <SettingsRow
        :label="comments.notifyReply"
        :description="comments.notifyReplyHint"
        :modified="reply !== defaults.commentReply"
        @reset="reply = defaults.commentReply"
      >
        <AppSwitch v-model="reply" :label="comments.notifyReply" />
      </SettingsRow>
      <SettingsRow
        :label="notifications.notifySaveFailed"
        :description="notifications.notifySaveFailedHint"
        :modified="saveFailed !== defaults.saveFailed"
        @reset="saveFailed = defaults.saveFailed"
      >
        <AppSwitch v-model="saveFailed" :label="notifications.notifySaveFailed" />
      </SettingsRow>
      <template v-if="CLOUD_INCLUDED">
        <SettingsRow
          :label="cloud.notifyConflict"
          :description="cloud.notifyConflictHint"
          :modified="cloudConflict !== defaults.cloudConflict"
          @reset="cloudConflict = defaults.cloudConflict"
        >
          <AppSwitch v-model="cloudConflict" :label="cloud.notifyConflict" />
        </SettingsRow>
        <SettingsRow
          :label="cloud.notifyStorageFull"
          :description="cloud.notifyStorageFullHint"
          :modified="cloudStorageFull !== defaults.cloudStorageFull"
          @reset="cloudStorageFull = defaults.cloudStorageFull"
        >
          <AppSwitch v-model="cloudStorageFull" :label="cloud.notifyStorageFull" />
        </SettingsRow>
      </template>
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
