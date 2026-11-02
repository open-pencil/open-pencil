<script setup lang="ts">
import { isEqual } from 'es-toolkit'
import { computed } from 'vue'

import { type Locale, useI18n } from '@open-pencil/vue/i18n'

import { recoveryEnabled, setRecoveryEnabled } from '@/app/document/recovery/preferences'
import { DEFAULT_RECENT_FILES_LIMIT } from '@/app/recent-files/limit'
import { recentFilesAvailable, recentFilesLimit } from '@/app/recent-files/preferences'
import { RECENT_FILES_LIMIT_MIN, RECENT_FILES_LIMIT_MAX } from '@/app/recent-files/schema'
import {
  appPreferences,
  DEFAULT_APP_PREFERENCES,
  updateAccentPreference
} from '@/app/settings/preferences/store'
import { DEFAULT_THEME } from '@/app/settings/theme'
import { DEFAULT_ACCENT } from '@/app/shell/accent/palette'
import { animationPreference } from '@/app/shell/motion'
import { useAppTheme } from '@/app/shell/theme'
import CredentialSettingsSection from '@/components/settings/credentials/CredentialSettingsSection.vue'
import AccentColorPicker from '@/components/settings/general/AccentColorPicker.vue'
import CollaborationNameSection from '@/components/settings/general/CollaborationNameSection.vue'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsResetButton from '@/components/settings/layout/SettingsResetButton.vue'
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

const defaultAnimations = DEFAULT_APP_PREFERENCES.appearance.animations
const defaultRecovery = DEFAULT_APP_PREFERENCES.recovery.enabled
const accentModified = computed(
  () => !isEqual(appPreferences.value.appearance.accent, DEFAULT_ACCENT)
)

const preserveUnsavedWork = computed({
  get: () => recoveryEnabled.value,
  set: setRecoveryEnabled
})
</script>

<template>
  <section class="flex flex-col gap-6" data-test-id="settings-general-panel">
    <SettingsSection>
      <template #title>{{ menu.language }}</template>
      <template #description>{{ settings.languageDescription }}</template>
      <SettingsGroup>
        <SettingsRow as="label" :label="menu.language">
          <AppSelect
            v-model="language"
            :label="menu.language"
            :options="languageOptions"
            :ui="selectUI"
            data-test-id="settings-language"
          />
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection>
      <template #title>{{ settings.appearance }}</template>
      <SettingsGroup>
        <SettingsRow
          as="label"
          :label="menu.theme"
          :modified="theme !== DEFAULT_THEME"
          @reset="theme = DEFAULT_THEME"
        >
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
        </SettingsRow>
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5">
          <span class="text-xs font-medium text-surface">{{ settings.accentColor }}</span>
          <span class="flex items-center gap-1">
            <SettingsResetButton
              v-if="accentModified"
              @reset="updateAccentPreference({ ...DEFAULT_ACCENT })"
            />
            <AccentColorPicker />
          </span>
        </div>
        <SettingsRow
          as="label"
          :label="settings.animations"
          :modified="animationPreference !== defaultAnimations"
          @reset="animationPreference = defaultAnimations"
        >
          <AppSelect
            v-model="animationPreference"
            :label="settings.animations"
            :options="[
              { value: 'system', label: settings.animationsSystem },
              { value: 'off', label: settings.animationsOff }
            ]"
            :ui="selectUI"
          />
        </SettingsRow>
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
          :modified="preserveUnsavedWork !== defaultRecovery"
          @reset="preserveUnsavedWork = defaultRecovery"
        >
          <AppSwitch
            v-model="preserveUnsavedWork"
            :label="recovery.preserveUnsavedWork"
            data-test-id="settings-recovery-enabled"
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
          :modified="recentFilesLimit !== DEFAULT_RECENT_FILES_LIMIT"
          @reset="recentFilesLimit = DEFAULT_RECENT_FILES_LIMIT"
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
  </section>
</template>
