<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { appRuntimeConfig } from '@/app/runtime/config'
import {
  appPreferences,
  DEFAULT_APP_PREFERENCES,
  updateCanvasRenderingMode
} from '@/app/settings/preferences/store'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppBadge from '@/components/ui/feedback/AppBadge.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { rendering } = useI18n()
const hasURLOverride = appRuntimeConfig.sceneRendererOverride
const tiledRendering = computed(() => appPreferences.value.rendering.canvasMode === 'tiled')
const defaultTiledRendering = DEFAULT_APP_PREFERENCES.rendering.canvasMode === 'tiled'
const changed = computed(
  () => appPreferences.value.rendering.canvasMode !== appRuntimeConfig.sceneRenderer
)

function setTiledRendering(enabled: boolean): void {
  updateCanvasRenderingMode(enabled ? 'tiled' : 'retained')
}
</script>

<template>
  <SettingsSection>
    <template #title>{{ rendering.settingsTitle }}</template>
    <template #description>{{ rendering.settingsDescription }}</template>

    <SettingsGroup>
      <SettingsRow
        as="label"
        :description="rendering.progressiveTiledDescription"
        :modified="tiledRendering !== defaultTiledRendering"
        @reset="setTiledRendering(defaultTiledRendering)"
      >
        <template #label>
          <span class="flex flex-wrap items-center gap-2">
            {{ rendering.progressiveTiled }}
            <AppBadge :ui="{ base: 'bg-hover text-surface' }">{{
              rendering.experimental
            }}</AppBadge>
          </span>
        </template>
        <AppSwitch
          :model-value="tiledRendering"
          :label="rendering.progressiveTiled"
          data-test-id="settings-progressive-tiled-rendering"
          @update:model-value="setTiledRendering"
        />
      </SettingsRow>
    </SettingsGroup>

    <AppAlert v-if="hasURLOverride" :heading="rendering.urlOverride" />
    <AppAlert v-else-if="changed" :heading="rendering.reloadRequired" />
  </SettingsSection>
</template>
