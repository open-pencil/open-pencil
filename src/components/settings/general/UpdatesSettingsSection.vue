<script setup lang="ts">
import { computed } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'
import { useUpdateMessages } from '@open-pencil/vue/i18n'

import {
  appPreferences,
  DEFAULT_APP_PREFERENCES,
  updateStartupUpdateCheck
} from '@/app/settings/preferences/store'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const updates = useUpdateMessages()
const defaultCheckOnStartup = DEFAULT_APP_PREFERENCES.updates.checkOnStartup
const checkOnStartup = computed({
  get: () => appPreferences.value.updates.checkOnStartup,
  set: updateStartupUpdateCheck
})
</script>

<template>
  <SettingsSection v-if="IS_TAURI" data-test-id="settings-updates">
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
    </SettingsGroup>
  </SettingsSection>
</template>
