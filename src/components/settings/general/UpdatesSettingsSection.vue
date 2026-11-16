<script setup lang="ts">
import { computed } from 'vue'

import { useUpdateMessages } from '@open-pencil/vue/i18n'

import {
  appPreferences,
  DEFAULT_APP_PREFERENCES,
  updateStartupUpdateCheck,
  updateUpdateChannel
} from '@/app/settings/preferences/store'
import {
  buildUpdateChannel,
  resolveUpdateChannel,
  type UpdateChannel
} from '@/app/shell/updater/channel'
import { canSelfUpdate } from '@/app/tauri/capabilities'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
import { settingsSelectUI } from '@/theme/settings/controls'

const updates = useUpdateMessages()
// A package whose store delivers updates has no built-in check to switch.
const offered = canSelfUpdate()
const defaultCheckOnStartup = DEFAULT_APP_PREFERENCES.updates.checkOnStartup
const checkOnStartup = computed({
  get: () => appPreferences.value.updates.checkOnStartup,
  set: updateStartupUpdateCheck
})
// Until a channel is chosen it follows the installed build, which Reset goes back to.
const channel = computed<UpdateChannel>({
  get: () => resolveUpdateChannel(appPreferences.value.updates.channel),
  set: updateUpdateChannel
})
const channelOptions = computed(() => [
  { value: 'stable' as const, label: updates.value.channelStable },
  { value: 'nightly' as const, label: updates.value.channelNightly }
])
</script>

<template>
  <SettingsSection v-if="offered" data-test-id="settings-updates">
    <template #title>{{ updates.settingsSection }}</template>
    <SettingsGroup>
      <SettingsRow
        as="label"
        :label="updates.checkOnStartup"
        :description="updates.checkOnStartupDescription"
        :modified="checkOnStartup !== defaultCheckOnStartup"
        @reset="checkOnStartup = defaultCheckOnStartup"
      >
        <AppSwitch
          v-model="checkOnStartup"
          :label="updates.checkOnStartup"
          data-test-id="settings-startup-update-check"
        />
      </SettingsRow>
      <SettingsRow
        :label="updates.channel"
        :description="updates.channelDescription"
        :modified="channel !== buildUpdateChannel()"
        class="max-sm:flex-col max-sm:items-stretch"
        @reset="updateUpdateChannel('build')"
      >
        <AppSelect
          v-model="channel"
          :label="updates.channel"
          :options="channelOptions"
          :ui="settingsSelectUI"
          data-test-id="settings-update-channel"
        />
      </SettingsRow>
    </SettingsGroup>
  </SettingsSection>
</template>
