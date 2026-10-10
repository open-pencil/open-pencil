<script setup lang="ts">
import { computed } from 'vue'

import { type Locale, useI18n } from '@open-pencil/vue'

import { recoveryEnabled, setRecoveryEnabled } from '@/app/document/recovery/preferences'
import { setSnappingPreference } from '@/app/settings/preferences/apply'
import { appPreferences } from '@/app/settings/preferences/store'
import { animationPreference } from '@/app/shell/motion'
import { useAppTheme } from '@/app/shell/theme'
import CredentialSettingsSection from '@/components/settings/credentials/CredentialSettingsSection.vue'
import AccentColorPicker from '@/components/settings/general/AccentColorPicker.vue'
import CollaborationNameSection from '@/components/settings/general/CollaborationNameSection.vue'
import RenderingSettingsSection from '@/components/settings/general/RenderingSettingsSection.vue'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { availableLocales, locale, localeLabels, menu, recovery, setLocale, settings } = useI18n()

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
        <label class="flex items-center justify-between gap-4 px-3 py-2.5">
          <span>
            <span class="block text-xs text-surface">{{ recovery.preserveUnsavedWork }}</span>
            <span class="block text-[10px] text-muted">{{
              recovery.preserveUnsavedWorkDescription
            }}</span>
          </span>
          <AppSwitch
            v-model="preserveUnsavedWork"
            :label="recovery.preserveUnsavedWork"
            data-test-id="settings-recovery-enabled"
          />
        </label>
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection>
      <template #title>{{ settings.editing }}</template>
      <template #description>{{ settings.snappingDescription }}</template>

      <SettingsGroup>
        <label class="flex items-center justify-between gap-4 px-3 py-2.5">
          <span>
            <span class="block text-xs text-surface">{{ settings.snapToGeometry }}</span>
            <span class="block text-[10px] text-muted">{{
              settings.snapToGeometryDescription
            }}</span>
          </span>
          <AppSwitch
            v-model="snapToGeometry"
            :label="settings.snapToGeometry"
            data-test-id="settings-snap-geometry"
          />
        </label>
        <label class="flex items-center justify-between gap-4 px-3 py-2.5">
          <span>
            <span class="block text-xs text-surface">{{ settings.snapToObjects }}</span>
            <span class="block text-[10px] text-muted">{{
              settings.snapToObjectsDescription
            }}</span>
          </span>
          <AppSwitch
            v-model="snapToObjects"
            :label="settings.snapToObjects"
            data-test-id="settings-snap-objects"
          />
        </label>
        <label class="flex items-center justify-between gap-4 px-3 py-2.5">
          <span>
            <span class="block text-xs text-surface">{{ settings.snapToPixelGrid }}</span>
            <span class="block text-[10px] text-muted">{{
              settings.snapToPixelGridDescription
            }}</span>
          </span>
          <AppSwitch
            v-model="snapToPixelGrid"
            :label="settings.snapToPixelGrid"
            data-test-id="settings-snap-pixel-grid"
          />
        </label>
      </SettingsGroup>

      <p class="text-[11px] text-muted">{{ settings.temporaryDisableSnappingHint }}</p>
    </SettingsSection>

    <CredentialSettingsSection />
    <RenderingSettingsSection />
  </section>
</template>
