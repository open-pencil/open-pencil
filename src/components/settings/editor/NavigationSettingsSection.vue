<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import {
  appPreferences,
  DEFAULT_APP_PREFERENCES,
  updateZoomSpeed,
  ZOOM_SPEEDS,
  type ZoomSpeed
} from '@/app/settings/preferences/store'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const { locale, settings } = useI18n()
const selectUI = { trigger: 'w-full sm:w-52' }

const zoomSpeed = computed<ZoomSpeed>({
  get: () => appPreferences.value.navigation.zoomSpeed,
  set: updateZoomSpeed
})

const defaultZoomSpeed = DEFAULT_APP_PREFERENCES.navigation.zoomSpeed

const zoomSpeedOptions = computed(() => {
  const format = new Intl.NumberFormat(locale.value)
  return ZOOM_SPEEDS.map((value) => ({ value, label: `${format.format(value)}×` }))
})
</script>

<template>
  <SettingsSection>
    <template #title>{{ settings.navigation }}</template>
    <template #description>{{ settings.navigationDescription }}</template>

    <SettingsGroup>
      <SettingsRow
        :label="settings.zoomSpeed"
        :description="settings.zoomSpeedDescription"
        :modified="zoomSpeed !== defaultZoomSpeed"
        @reset="zoomSpeed = defaultZoomSpeed"
      >
        <AppSelect
          v-model="zoomSpeed"
          :label="settings.zoomSpeed"
          :options="zoomSpeedOptions"
          :ui="selectUI"
          data-test-id="settings-zoom-speed"
        />
      </SettingsRow>
    </SettingsGroup>
  </SettingsSection>
</template>
