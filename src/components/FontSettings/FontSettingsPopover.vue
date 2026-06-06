<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { onMounted, ref } from 'vue'

import { isTauri } from '@/app/tauri/env'
import { useFontSettings } from '@/components/FontSettings/use'
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
  googleFontsEnabled,
  clearCache,
  downloadFallbacks,
  refreshSummary,
  requestAccess,
  setGoogleFontsEnabled
} = useFontSettings()

function setPopoverOpen(value: boolean) {
  popoverOpen.value = value
  if (value) void refreshSummary()
}

onMounted(() => {
  void refreshSummary()
})
</script>

<template>
  <PopoverRoot v-model:open="popoverOpen" @update:open="setPopoverOpen">
    <Tip :label="dialogs.fontSettings" :disabled="popoverOpen">
      <PopoverTrigger data-test-id="font-settings-trigger" :class="trigger.base">
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
                    ? 'Access system fonts, Google Fonts, fallback packs, and cached downloads.'
                    : 'Allow browser access to local fonts and manage Google Fonts.'
                }}
              </p>
            </div>
          </div>

          <div class="grid gap-1.5 rounded border border-border bg-input/40 p-2 text-[10px]">
            <div class="flex justify-between gap-3 text-muted">
              <span>Local fonts</span>
              <span class="text-surface">{{ accessStateLabel }}</span>
            </div>
            <div class="flex justify-between gap-3 text-muted">
              <span>Google Fonts</span>
              <span class="text-surface">{{ googleFontsEnabled ? 'Enabled' : 'Disabled' }}</span>
            </div>
            <div v-if="showDownloadedFonts" class="flex justify-between gap-3 text-muted">
              <span>Downloaded cache</span>
              <span class="text-surface">{{ cacheCount }} fonts · {{ cacheSize }}</span>
            </div>
            <div v-if="showDownloadedFonts" class="flex justify-between gap-3 text-muted">
              <span>Last updated</span>
              <span class="text-surface">{{ cacheUpdatedLabel }}</span>
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="grid grid-cols-[1fr_auto] gap-2 rounded border border-border p-2">
              <div>
                <p class="text-[10px] font-medium text-surface">System font access</p>
                <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                  {{
                    accessState === 'granted'
                      ? 'System fonts are available.'
                      : 'Allow browser font access when system fonts are missing.'
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
                {{ busyAction === 'access' ? 'Requesting…' : 'Allow' }}
              </button>
            </div>

            <div class="grid grid-cols-[1fr_auto] gap-2 rounded border border-border p-2">
              <div>
                <p class="text-[10px] font-medium text-surface">Google Fonts</p>
                <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                  Show fonts from Google in the font picker.
                </p>
              </div>
              <button
                type="button"
                data-test-id="font-settings-toggle-google-fonts"
                :class="secondaryButton.base"
                :disabled="busyAction !== null"
                @click="setGoogleFontsEnabled(!googleFontsEnabled)"
              >
                {{ googleFontsEnabled ? 'Disable' : 'Enable' }}
              </button>
            </div>

            <div
              v-if="showDownloadedFonts"
              class="grid grid-cols-[1fr_auto] gap-2 rounded border border-border p-2"
            >
              <div>
                <p class="text-[10px] font-medium text-surface">Fallback packs</p>
                <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                  Download CJK and Arabic fallbacks before opening files that need them.
                </p>
              </div>
              <button
                type="button"
                data-test-id="font-settings-download-fallbacks"
                :class="primaryButton.base"
                :disabled="busyAction !== null"
                @click="downloadFallbacks"
              >
                {{ busyAction === 'download' ? 'Downloading…' : 'Download' }}
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
              Refresh
            </button>
            <button
              type="button"
              data-test-id="font-settings-clear-cache"
              :class="secondaryButton.base"
              :disabled="busyAction !== null || cacheCount === 0"
              @click="clearCache"
            >
              Clear cache
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
