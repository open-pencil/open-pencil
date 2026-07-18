<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { onMounted, ref } from 'vue'

import { isTauri } from '@/app/tauri/env'
import { useFontSettings } from '@/components/FontSettings/use'
import { WEB_FONT_PROVIDER_IDS, WEB_FONT_PROVIDER_LABELS } from '@open-pencil/core/text'
import type { WebFontProviderId } from '@open-pencil/core/text'
import { useI18n } from '@open-pencil/vue'
import Tip from '@/components/ui/Tip.vue'
import { useButtonUI } from '@/components/ui/button'
import { usePopoverUI } from '@/components/ui/popover'

const { dialogs } = useI18n()
const cls = usePopoverUI({ content: 'isolate z-[51] w-80 p-3' })
const trigger = useButtonUI({
  tone: 'ghost',
  size: 'iconSm',
  ui: { base: 'shrink-0 border border-border bg-input' }
})
const secondaryButton = useButtonUI({
  tone: 'ghost',
  size: 'sm',
  ui: {
    base: 'w-full bg-input px-2 py-1.5 text-[10px] font-medium text-surface hover:bg-hover disabled:opacity-50'
  }
})
const primaryButton = useButtonUI({
  tone: 'accent',
  size: 'sm',
  ui: { base: 'w-full px-2 py-1.5 text-[10px] font-medium disabled:opacity-50' }
})
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
    <Tip :label="dialogs.fontSettings" :disabled="popoverOpen">
      <PopoverTrigger
        data-test-id="font-settings-trigger"
        :aria-label="dialogs.fontSettings"
        :class="trigger.base"
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
              <h3 class="text-[11px] font-semibold text-surface">{{ dialogs.fontSettings }}</h3>
              <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                {{
                  showDownloadedFonts
                    ? dialogs.fontSettingsDesktopDescription
                    : dialogs.fontSettingsBrowserDescription
                }}
              </p>
            </div>
          </div>

          <div class="grid gap-1.5 rounded border border-border bg-input/40 p-2 text-[10px]">
            <div class="flex justify-between gap-3 text-muted">
              <span>{{ dialogs.localFonts }}</span>
              <span class="text-surface">{{ accessStateLabel }}</span>
            </div>
            <div class="flex justify-between gap-3 text-muted">
              <span>{{ dialogs.onlineFonts }}</span>
              <span class="text-surface">{{
                onlineFontsEnabled ? dialogs.enabled : dialogs.disabled
              }}</span>
            </div>
            <div v-if="showDownloadedFonts" class="flex justify-between gap-3 text-muted">
              <span>{{ dialogs.downloadedCache }}</span>
              <span class="text-surface">{{ cacheCount }} fonts · {{ cacheSize }}</span>
            </div>
            <div v-if="showDownloadedFonts" class="flex justify-between gap-3 text-muted">
              <span>{{ dialogs.lastUpdated }}</span>
              <span class="text-surface">{{ cacheUpdatedLabel }}</span>
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="grid grid-cols-[1fr_auto] gap-2 rounded border border-border p-2">
              <div>
                <p class="text-[10px] font-medium text-surface">{{ dialogs.systemFontAccess }}</p>
                <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                  {{
                    accessState === 'granted'
                      ? dialogs.systemFontsAvailable
                      : dialogs.allowBrowserFontAccess
                  }}
                </p>
              </div>
              <button
                type="button"
                data-test-id="font-settings-request-access"
                :class="secondaryButton.base"
                :disabled="busyAction !== null || !canRequestLocalFonts"
                @click="requestAccess"
              >
                {{ busyAction === 'access' ? dialogs.requesting : dialogs.allow }}
              </button>
            </div>

            <div class="grid gap-2 rounded border border-border p-2">
              <div class="grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <p class="text-[10px] font-medium text-surface">
                    {{ dialogs.onlineFontProviders }}
                  </p>
                  <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                    {{ dialogs.downloadMissingWebFonts }}
                  </p>
                </div>
                <button
                  type="button"
                  data-test-id="font-settings-toggle-online-fonts"
                  :class="secondaryButton.base"
                  :disabled="busyAction !== null"
                  @click="setOnlineFontsEnabled(!onlineFontsEnabled)"
                >
                  {{ onlineFontsEnabled ? dialogs.disable : dialogs.enable }}
                </button>
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
                <p class="text-[10px] font-medium text-surface">{{ dialogs.fallbackPacks }}</p>
                <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                  {{ dialogs.downloadFallbackPacksDescription }}
                </p>
              </div>
              <button
                type="button"
                data-test-id="font-settings-download-fallbacks"
                :class="primaryButton.base"
                :disabled="busyAction !== null"
                @click="downloadFallbacks"
              >
                {{ busyAction === 'download' ? dialogs.downloading : dialogs.download }}
              </button>
            </div>
          </div>

          <div v-if="showDownloadedFonts" class="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              data-test-id="font-settings-refresh-cache"
              :class="secondaryButton.base"
              :disabled="busyAction !== null"
              @click="refreshSummary"
            >
              {{ dialogs.refresh }}
            </button>
            <button
              type="button"
              data-test-id="font-settings-clear-cache"
              :class="secondaryButton.base"
              :disabled="busyAction !== null || cacheCount === 0"
              @click="clearCache"
            >
              {{ dialogs.clearCache }}
            </button>
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
