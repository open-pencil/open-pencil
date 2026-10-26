<script setup lang="ts">
import { computed } from 'vue'

import { useSettingsMessages } from '@open-pencil/vue/i18n'

import { setSnappingPreference } from '@/app/settings/preferences/apply'
import { appPreferences } from '@/app/settings/preferences/store'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const settings = useSettingsMessages()

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
</template>
