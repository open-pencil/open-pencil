<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { onMounted, ref } from 'vue'

import { isTauri } from '@/app/tauri/env'
import { useFontSettings } from '@/components/FontSettings/use'
import { WEB_FONT_PROVIDER_IDS, WEB_FONT_PROVIDER_LABELS } from '@open-pencil/core/text'
import type { WebFontProviderId } from '@open-pencil/core/text'
import { useI18n } from '@open-pencil/vue'
import Tip from '@/components/ui/Tip.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { usePopoverUI } from '@/components/ui/popover'

const { fonts, common } = useI18n()
const cls = usePopoverUI({ content: 'isolate z-[51] w-80 p-3' })
const trigger = 'shrink-0'
const secondaryButton = {
  color: 'neutral' as const,
  variant: 'soft' as const,
  size: 'xs' as const
}
const primaryButton = {
  color: 'primary' as const,
  variant: 'solid' as const,
  size: 'xs' as const
}
const showDownloadedFonts = isTauri()
const webFontProviderIds = WEB_FONT_PROVIDER_IDS
const popoverOpen = ref(false)

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

function setPopoverOpen(value: boolean) {
  popoverOpen.value = value
  if (value) void refreshSummary()
}

function isProviderEnabled(provider: WebFontProviderId) {
  return fontProviderSettings.value[provider]
}

function onProviderToggle(provider: WebFontProviderId, event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  setFontProviderEnabled(provider, input.checked)
}

onMounted(() => {
  void refreshSummary()
})
</script>

<template>
  <PopoverRoot v-model:open="popoverOpen" @update:open="setPopoverOpen">
    <Tip :label="fonts.settingsTitle" :disabled="popoverOpen">
      <PopoverTrigger
        data-test-id="font-settings-trigger"
        :aria-label="fonts.settingsTitle"
        :class="trigger"
      >
        <icon-lucide-settings class="size-3.5" />
      </PopoverTrigger>
    </Tip>

    <PopoverPortal>
      <PopoverContent
        data-test-id="font-settings-panel"
        side="left"
        :side-offset="8"
        align="start"
        :collision-padding="16"
        :avoid-collisions="true"
        :class="cls.content"
      >
        <div class="flex flex-col gap-3">
          <div class="flex items-start gap-2">
            <div
              class="flex size-8 shrink-0 items-center justify-center rounded bg-input text-muted"
            >
              <icon-lucide-type class="size-4" />
            </div>
            <div>
              <h3 class="text-[11px] font-semibold text-surface">{{ fonts.settingsTitle }}</h3>
              <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                {{
                  showDownloadedFonts
                    ? fonts.settingsDesktopDescription
                    : fonts.settingsBrowserDescription
                }}
              </p>
            </div>
          </div>

          <div class="grid gap-1.5 rounded border border-border bg-input/40 p-2 text-[10px]">
            <div class="flex justify-between gap-3 text-muted">
              <span>{{ fonts.localFonts }}</span>
              <span class="text-surface">{{ accessStateLabel }}</span>
            </div>
            <div class="flex justify-between gap-3 text-muted">
              <span>{{ fonts.onlineFonts }}</span>
              <span class="text-surface">{{
                onlineFontsEnabled ? common.enabled : common.disabled
              }}</span>
            </div>
            <div v-if="showDownloadedFonts" class="flex justify-between gap-3 text-muted">
              <span>{{ fonts.downloadedCache }}</span>
              <span class="text-surface">{{ cacheCount }} fonts · {{ cacheSize }}</span>
            </div>
            <div v-if="showDownloadedFonts" class="flex justify-between gap-3 text-muted">
              <span>{{ common.lastUpdated }}</span>
              <span class="text-surface">{{ cacheUpdatedLabel }}</span>
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="grid grid-cols-[1fr_auto] gap-2 rounded border border-border p-2">
              <div>
                <p class="text-[10px] font-medium text-surface">{{ fonts.systemFontAccess }}</p>
                <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                  {{
                    accessState === 'granted'
                      ? fonts.systemFontsAvailable
                      : fonts.allowBrowserFontAccess
                  }}
                </p>
              </div>
              <AppButton
                type="button"
                data-test-id="font-settings-request-access"
                :color="secondaryButton.color"
                :variant="secondaryButton.variant"
                :size="secondaryButton.size"
                :disabled="busyAction !== null || !canRequestLocalFonts"
                @click="requestAccess"
              >
                {{ busyAction === 'access' ? common.requesting : common.allow }}
              </AppButton>
            </div>

            <div class="grid gap-2 rounded border border-border p-2">
              <div class="grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <p class="text-[10px] font-medium text-surface">
                    {{ fonts.onlineFontProviders }}
                  </p>
                  <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                    {{ fonts.downloadMissingWebFonts }}
                  </p>
                </div>
                <AppButton
                  type="button"
                  data-test-id="font-settings-toggle-online-fonts"
                  :color="secondaryButton.color"
                  :variant="secondaryButton.variant"
                  :size="secondaryButton.size"
                  :disabled="busyAction !== null"
                  @click="setOnlineFontsEnabled(!onlineFontsEnabled)"
                >
                  {{ onlineFontsEnabled ? common.disable : common.enable }}
                </AppButton>
              </div>

              <div class="grid gap-1 border-t border-border pt-2">
                <label
                  v-for="provider in webFontProviderIds"
                  :key="provider"
                  class="flex items-center justify-between gap-2 text-[10px] text-muted"
                >
                  <span>{{ WEB_FONT_PROVIDER_LABELS[provider] }}</span>
                  <input
                    type="checkbox"
                    class="size-3 accent-accent disabled:opacity-50"
                    :checked="isProviderEnabled(provider)"
                    :disabled="busyAction !== null || !onlineFontsEnabled"
                    :data-test-id="`font-settings-provider-${provider}`"
                    @change="onProviderToggle(provider, $event)"
                  />
                </label>
              </div>
            </div>

            <div
              v-if="showDownloadedFonts"
              class="grid grid-cols-[1fr_auto] gap-2 rounded border border-border p-2"
            >
              <div>
                <p class="text-[10px] font-medium text-surface">{{ fonts.fallbackPacks }}</p>
                <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                  {{ fonts.downloadFallbackPacksDescription }}
                </p>
              </div>
              <AppButton
                type="button"
                data-test-id="font-settings-download-fallbacks"
                :color="primaryButton.color"
                :variant="primaryButton.variant"
                :size="primaryButton.size"
                :disabled="busyAction !== null"
                @click="downloadFallbacks"
              >
                {{ busyAction === 'download' ? common.downloading : common.download }}
              </AppButton>
            </div>
          </div>

          <div v-if="showDownloadedFonts" class="grid grid-cols-2 gap-1.5">
            <AppButton
              type="button"
              data-test-id="font-settings-refresh-cache"
              :color="secondaryButton.color"
              :variant="secondaryButton.variant"
              :size="secondaryButton.size"
              :disabled="busyAction !== null"
              @click="refreshSummary"
            >
              {{ common.refresh }}
            </AppButton>
            <AppButton
              type="button"
              data-test-id="font-settings-clear-cache"
              :color="secondaryButton.color"
              :variant="secondaryButton.variant"
              :size="secondaryButton.size"
              :disabled="busyAction !== null || cacheCount === 0"
              @click="clearCache"
            >
              {{ fonts.clearCache }}
            </AppButton>
          </div>

          <p
            v-if="status"
            class="rounded bg-input px-2 py-1.5 text-[10px] leading-relaxed text-muted"
          >
            {{ status }}
          </p>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
