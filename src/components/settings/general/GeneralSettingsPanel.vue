<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@open-pencil/vue'

import { recoveryEnabled, setRecoveryEnabled } from '@/app/document/recovery/preferences'
import { setSnappingPreference } from '@/app/settings/preferences/apply'
import { appPreferences } from '@/app/settings/preferences/store'
import AppSwitch from '@/components/ui/AppSwitch.vue'

const { recovery, settings } = useI18n()

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
      <h3 class="text-xs font-semibold text-surface">{{ recovery.settingsRecovery }}</h3>
      <p class="mt-1 text-[11px] text-muted">{{ recovery.settingsRecoveryDescription }}</p>
    </div>

    <div class="flex flex-col rounded border border-border">
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
    </div>

    <div>
      <h3 class="text-xs font-semibold text-surface">{{ settings.settingsEditing }}</h3>
      <p class="mt-1 text-[11px] text-muted">{{ settings.settingsSnappingDescription }}</p>
    </div>

    <div class="flex flex-col divide-y divide-border rounded border border-border">
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
    </div>

    <p class="text-[10px] text-muted">{{ settings.snapTemporaryDisableHint }}</p>
  </section>
</template>
