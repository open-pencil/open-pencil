<script setup lang="ts">
import { computed } from 'vue'

import { type Locale, useI18n } from '@open-pencil/vue/i18n'

import { recoveryEnabled, setRecoveryEnabled } from '@/app/document/recovery/preferences'
import { recentFilesAvailable, recentFilesLimit } from '@/app/recent-files/preferences'
import { RECENT_FILES_LIMIT_MIN, RECENT_FILES_LIMIT_MAX } from '@/app/recent-files/schema'
import { setSnappingPreference } from '@/app/settings/preferences/apply'
import {
  appPreferences,
  updateZoomSpeed,
  ZOOM_SPEEDS,
  type ZoomSpeed
} from '@/app/settings/preferences/store'
import { animationPreference } from '@/app/shell/motion'
import { useAppTheme } from '@/app/shell/theme'
import CredentialSettingsSection from '@/components/settings/credentials/CredentialSettingsSection.vue'
import AccentColorPicker from '@/components/settings/general/AccentColorPicker.vue'
import CollaborationNameSection from '@/components/settings/general/CollaborationNameSection.vue'
import RenderingSettingsSection from '@/components/settings/general/RenderingSettingsSection.vue'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import PresetNumberField from '@/components/ui/input/PresetNumberField.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { availableLocales, locale, localeLabels, menu, recovery, setLocale, settings } = useI18n()

const showRecentFiles = recentFilesAvailable()
const recentFilesPresets = [10, 25, 50, 100]
const recentFilesRangeMessage = computed(() =>
  settings.value.recentFilesLimitRange({ min: RECENT_FILES_LIMIT_MIN, max: RECENT_FILES_LIMIT_MAX })
)

const { theme } = useAppTheme()
const selectUI = { trigger: 'w-full sm:w-52' }

const language = computed<Locale>({
  get: () => locale.value,
  set: setLocale
})

const languageOptions = availableLocales.map((value) => ({
  value,
  label: localeLabels[value]
}))

const preserveUnsavedWork = computed({
  get: () => recoveryEnabled.value,
  set: setRecoveryEnabled
})

const snapToGeometry = computed({
  get: () => appPreferences.value.editing.snapping.geometry,
  set: (enabled: boolean) => setSnappingPreference('geometry', enabled)
})

const snapToObjects = computed({
  get: () => appPreferences.value.editing.snapping.objects,
  set: (enabled: boolean) => setSnappingPreference('objects', enabled)
})

const snapToPixelGrid = computed({
  get: () => appPreferences.value.editing.snapping.pixelGrid,
  set: (enabled: boolean) => setSnappingPreference('pixelGrid', enabled)
})

const zoomSpeed = computed<ZoomSpeed>({
  get: () => appPreferences.value.navigation.zoomSpeed,
  set: updateZoomSpeed
})

const zoomSpeedOptions = computed(() => {
  const format = new Intl.NumberFormat(locale.value)
  return ZOOM_SPEEDS.map((value) => {
    const speed = `${format.format(value)}×`
    return { value, label: value === 1 ? settings.value.zoomSpeedDefault({ speed }) : speed }
  })
})
</script>

<template>
  <section class="flex flex-col gap-6" data-test-id="settings-general-panel">
    <SettingsSection>
      <template #title>{{ menu.language }}</template>
      <template #description>{{ settings.languageDescription }}</template>
      <SettingsGroup>
        <label class="flex items-center justify-between gap-4 px-3 py-2.5">
          <span class="text-xs text-surface">{{ menu.language }}</span>
          <AppSelect
            v-model="language"
            :label="menu.language"
            :options="languageOptions"
            :ui="selectUI"
            data-test-id="settings-language"
          />
        </label>
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection>
      <template #title>{{ settings.appearance }}</template>
      <SettingsGroup>
        <label class="flex items-center justify-between gap-4 px-3 py-2.5">
          <span class="text-xs text-surface">{{ menu.theme }}</span>
          <AppSelect
            v-model="theme"
            :label="menu.theme"
            :options="[
              { value: 'auto', label: menu.themeAuto },
              { value: 'light', label: menu.themeLight },
              { value: 'dark', label: menu.themeDark }
            ]"
            :ui="selectUI"
          />
        </label>
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5">
          <span class="text-xs text-surface">{{ settings.accentColor }}</span>
          <AccentColorPicker />
        </div>
        <label class="flex items-center justify-between gap-4 px-3 py-2.5">
          <span class="text-xs text-surface">{{ settings.animations }}</span>
          <AppSelect
            v-model="animationPreference"
            :label="settings.animations"
            :options="[
              { value: 'system', label: settings.animationsSystem },
              { value: 'off', label: settings.animationsOff }
            ]"
            :ui="selectUI"
          />
        </label>
      </SettingsGroup>
    </SettingsSection>

    <CollaborationNameSection />

    <SettingsSection>
      <template #title>{{ recovery.settingsTitle }}</template>

      <SettingsGroup>
        <SettingsRow
          as="label"
          :label="recovery.preserveUnsavedWork"
          :description="recovery.preserveUnsavedWorkDescription"
        >
          <AppSwitch
            v-model="preserveUnsavedWork"
            :label="recovery.preserveUnsavedWork"
            data-test-id="settings-recovery-enabled"
          />
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection>
      <template #title>{{ settings.editing }}</template>
      <template #description>{{ settings.snappingDescription }}</template>

      <SettingsGroup>
        <SettingsRow
          as="label"
          :label="settings.snapToGeometry"
          :description="settings.snapToGeometryDescription"
        >
          <AppSwitch
            v-model="snapToGeometry"
            :label="settings.snapToGeometry"
            data-test-id="settings-snap-geometry"
          />
        </SettingsRow>
        <SettingsRow
          as="label"
          :label="settings.snapToObjects"
          :description="settings.snapToObjectsDescription"
        >
          <AppSwitch
            v-model="snapToObjects"
            :label="settings.snapToObjects"
            data-test-id="settings-snap-objects"
          />
        </SettingsRow>
        <SettingsRow
          as="label"
          :label="settings.snapToPixelGrid"
          :description="settings.snapToPixelGridDescription"
        >
          <AppSwitch
            v-model="snapToPixelGrid"
            :label="settings.snapToPixelGrid"
            data-test-id="settings-snap-pixel-grid"
          />
        </SettingsRow>
      </SettingsGroup>

      <p class="text-[11px] text-muted">{{ settings.temporaryDisableSnappingHint }}</p>
    </SettingsSection>

    <SettingsSection>
      <template #title>{{ settings.navigation }}</template>
      <template #description>{{ settings.navigationDescription }}</template>

      <SettingsGroup>
        <SettingsRow :label="settings.zoomSpeed" :description="settings.zoomSpeedDescription">
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

    <SettingsSection v-if="showRecentFiles">
      <template #title>{{ settings.recentFiles }}</template>
      <template #description>{{ settings.recentFilesDescription }}</template>
      <SettingsGroup>
        <SettingsRow
          :label="settings.recentFilesLimit"
          class="max-sm:flex-col max-sm:items-stretch"
        >
          <PresetNumberField
            v-model:number="recentFilesLimit"
            :presets="recentFilesPresets"
            :min="RECENT_FILES_LIMIT_MIN"
            :max="RECENT_FILES_LIMIT_MAX"
            :label="settings.recentFilesLimit"
            :custom-label="settings.recentFilesLimitCustom"
            :range-message="recentFilesRangeMessage"
          />
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>

    <CredentialSettingsSection />
    <RenderingSettingsSection />
  </section>
</template>
