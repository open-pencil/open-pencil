<script setup lang="ts">
import { computed } from 'vue'

import { useSettingsMessages } from '@open-pencil/vue/i18n'

import {
  appPreferences,
  DEFAULT_APP_PREFERENCES,
  updateNameImportedIcons
} from '@/app/settings/preferences/store'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const settings = useSettingsMessages()

const nameIcons = computed({
  get: () => appPreferences.value.import.nameIcons,
  set: updateNameImportedIcons
})

const defaultNameIcons = DEFAULT_APP_PREFERENCES.import.nameIcons
</script>

<template>
  <SettingsSection>
    <template #title>{{ settings.importing }}</template>
    <template #description>{{ settings.importingDescription }}</template>

    <SettingsGroup>
      <SettingsRow
        as="label"
        :label="settings.nameImportedIcons"
        :description="settings.nameImportedIconsDescription"
        :modified="nameIcons !== defaultNameIcons"
        @reset="nameIcons = defaultNameIcons"
      >
        <AppSwitch
          v-model="nameIcons"
          :label="settings.nameImportedIcons"
          data-test-id="settings-name-imported-icons"
        />
      </SettingsRow>
    </SettingsGroup>
  </SettingsSection>
</template>
