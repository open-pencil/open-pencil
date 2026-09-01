<script setup lang="ts">
import { computed } from 'vue'
import { type Locale, useI18n } from '@open-pencil/vue'

import { recoveryEnabled, setRecoveryEnabled } from '@/app/document/recovery/preferences'
import { setSnappingPreference } from '@/app/settings/preferences/apply'
import { appPreferences } from '@/app/settings/preferences/store'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import RenderingSettingsSection from '@/components/settings/general/RenderingSettingsSection.vue'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsSectionHeader from '@/components/settings/layout/SettingsSectionHeader.vue'

const { availableLocales, locale, localeLabels, menu, recovery, setLocale, settings } = useI18n()

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
  <section class="flex flex-col gap-4" data-test-id="settings-general-panel">
    <div>
      <h3 class="text-xs font-semibold text-surface">{{ menu.language }}</h3>
      <p class="mt-1 text-[11px] text-muted">{{ settings.languageDescription }}</p>
    </div>

    <div class="flex flex-col rounded border border-border">
      <label class="flex items-center justify-between gap-4 px-3 py-2.5">
        <span class="text-xs text-surface">{{ menu.language }}</span>
        <AppSelect
          v-model="language"
          :label="menu.language"
          :options="languageOptions"
          class="w-44"
          data-test-id="settings-language"
        />
      </label>
    </div>

    <SettingsSectionHeader>
      {{ recovery.settingsTitle }}
      <template #description>{{ recovery.settingsDescription }}</template>
    </SettingsSectionHeader>

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

    <SettingsSectionHeader>
      {{ settings.editing }}
      <template #description>{{ settings.snappingDescription }}</template>
    </SettingsSectionHeader>

    <SettingsGroup>
      <label class="flex items-center justify-between gap-4 px-3 py-2.5">
        <span>
          <span class="block text-xs text-surface">{{ settings.snapToGeometry }}</span>
          <span class="block text-[10px] text-muted">{{ settings.snapToGeometryDescription }}</span>
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
          <span class="block text-[10px] text-muted">{{ settings.snapToObjectsDescription }}</span>
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

    <p class="text-[10px] text-muted">{{ settings.temporaryDisableSnappingHint }}</p>

    <RenderingSettingsSection />
  </section>
</template>
