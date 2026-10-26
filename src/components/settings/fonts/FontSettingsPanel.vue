<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { WEB_FONT_PROVIDER_IDS, WEB_FONT_PROVIDER_LABELS } from '@open-pencil/core/text'
import type { WebFontProviderId } from '@open-pencil/core/text'
import { useI18n } from '@open-pencil/vue/i18n'

import { useFontSettings } from '@/app/settings/fonts/use'
import { isTauri } from '@/app/tauri/env'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

/**
 * Where text gets its fonts: the system's, online providers', and on desktop the downloaded
 * cache and fallback packs.
 */
const { fonts, common } = useI18n()
/** Only the desktop app downloads fonts to disk; the browser leaves caching to itself. */
const desktop = isTauri()
const {
  accessState,
  accessStateLabel,
  busyAction,
  cacheCount,
  cacheSize,
  cacheUpdatedLabel,
  canRequestLocalFonts,
  status,
  onlineFontsEnabled,
  fontProviderSettings,
  clearCache,
  downloadFallbacks,
  refreshSummary,
  requestAccess,
  setFontProviderEnabled,
  setOnlineFontsEnabled
} = useFontSettings()

const online = computed(() => onlineFontsEnabled.value)
const providerEnabled = (provider: WebFontProviderId) => fontProviderSettings.value[provider]

onMounted(() => {
  void refreshSummary()
})
</script>

<template>
  <div class="flex flex-col gap-6" data-test-id="font-settings-panel">
    <SettingsSection>
      <template #title>{{ fonts.settingsTitle }}</template>
      <template #description>{{
        desktop ? fonts.settingsDesktopDescription : fonts.settingsBrowserDescription
      }}</template>
      <SettingsGroup>
        <SettingsRow
          :label="fonts.systemFontAccess"
          :description="
            accessState === 'granted' ? fonts.systemFontsAvailable : fonts.allowBrowserFontAccess
          "
        >
          <AppButton
            v-if="canRequestLocalFonts"
            variant="outline"
            data-test-id="font-settings-request-access"
            :loading="busyAction === 'access'"
            :disabled="busyAction !== null"
            @click="requestAccess"
          >
            {{ common.allow }}
          </AppButton>
          <span v-else class="text-xs text-surface">{{ accessStateLabel }}</span>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection>
      <template #title>{{ fonts.onlineFontProviders }}</template>
      <template #description>{{ fonts.downloadMissingWebFonts }}</template>
      <SettingsGroup>
        <SettingsRow as="label" :label="fonts.onlineFonts">
          <AppSwitch
            :model-value="online"
            :label="fonts.onlineFonts"
            :disabled="busyAction !== null"
            @update:model-value="setOnlineFontsEnabled"
          />
        </SettingsRow>
        <SettingsRow
          v-for="provider in WEB_FONT_PROVIDER_IDS"
          :key="provider"
          as="label"
          :label="WEB_FONT_PROVIDER_LABELS[provider]"
        >
          <AppSwitch
            :model-value="providerEnabled(provider)"
            :label="WEB_FONT_PROVIDER_LABELS[provider]"
            :disabled="busyAction !== null || !online"
            @update:model-value="setFontProviderEnabled(provider, $event)"
          />
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection v-if="desktop">
      <template #title>{{ fonts.downloadedCache }}</template>
      <SettingsGroup>
        <SettingsRow
          :label="`${fonts.cachedFontCount(cacheCount)} · ${cacheSize}`"
          :description="`${common.lastUpdated}: ${cacheUpdatedLabel}`"
        >
          <span class="flex gap-2">
            <AppButton
              variant="outline"
              data-test-id="font-settings-refresh-cache"
              :disabled="busyAction !== null"
              @click="refreshSummary"
            >
              {{ common.refresh }}
            </AppButton>
            <AppButton
              variant="outline"
              data-test-id="font-settings-clear-cache"
              :loading="busyAction === 'clear'"
              :disabled="busyAction !== null || cacheCount === 0"
              @click="clearCache"
            >
              {{ fonts.clearCache }}
            </AppButton>
          </span>
        </SettingsRow>
        <SettingsRow
          :label="fonts.fallbackPacks"
          :description="fonts.downloadFallbackPacksDescription"
        >
          <AppButton
            variant="outline"
            data-test-id="font-settings-download-fallbacks"
            :loading="busyAction === 'download'"
            :disabled="busyAction !== null"
            @click="downloadFallbacks"
          >
            {{ common.download }}
          </AppButton>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>

    <p v-if="status" role="status" class="text-[11px] leading-relaxed text-muted">
      {{ status }}
    </p>
  </div>
</template>
