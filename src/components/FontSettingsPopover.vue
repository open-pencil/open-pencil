<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, onMounted, ref } from 'vue'

import {
  clearDownloadedFontCache,
  downloadedFontCacheSummary,
  localFontAccessState,
  predownloadFallbackFonts,
  requestLocalFontAccess
} from '@/app/editor/fonts'
import { usePopoverUI } from '@/components/ui/popover'

const cls = usePopoverUI({ content: 'isolate z-[51] w-72 p-3' })
const cacheCount = ref(0)
const cacheByteLength = ref(0)
const cacheUpdatedAt = ref<number | null>(null)
const accessState = ref(localFontAccessState())
const busyAction = ref<'access' | 'download' | 'clear' | 'refresh' | null>(null)
const status = ref('')

const cacheSize = computed(() => {
  if (cacheByteLength.value === 0) return '0 MB'
  return `${(cacheByteLength.value / 1024 / 1024).toFixed(1)} MB`
})

const cacheUpdatedLabel = computed(() => {
  if (cacheUpdatedAt.value === null) return 'Never'
  return new Date(cacheUpdatedAt.value).toLocaleDateString()
})

async function refreshSummary() {
  busyAction.value = busyAction.value ?? 'refresh'
  try {
    const summary = await downloadedFontCacheSummary()
    cacheCount.value = summary.count
    cacheByteLength.value = summary.byteLength
    cacheUpdatedAt.value = summary.updatedAt
    accessState.value = localFontAccessState()
  } finally {
    if (busyAction.value === 'refresh') busyAction.value = null
  }
}

async function requestAccess() {
  busyAction.value = 'access'
  status.value = ''
  try {
    await requestLocalFontAccess()
    accessState.value = localFontAccessState()
    status.value = 'Local font access enabled.'
  } catch {
    accessState.value = localFontAccessState()
    status.value = 'Local font access was not granted.'
  } finally {
    busyAction.value = null
  }
}

async function downloadFallbacks() {
  busyAction.value = 'download'
  status.value = ''
  try {
    await predownloadFallbackFonts()
    await refreshSummary()
    status.value = 'Fallback fonts downloaded.'
  } catch {
    status.value = 'Could not download fallback fonts.'
  } finally {
    busyAction.value = null
  }
}

async function clearCache() {
  busyAction.value = 'clear'
  status.value = ''
  try {
    await clearDownloadedFontCache()
    await refreshSummary()
    status.value = 'Downloaded font cache cleared.'
  } catch {
    status.value = 'Could not clear downloaded font cache.'
  } finally {
    busyAction.value = null
  }
}

onMounted(() => {
  void refreshSummary()
})
</script>

<template>
  <PopoverRoot @update:open="$event && refreshSummary()">
    <PopoverTrigger
      data-test-id="font-settings-trigger"
      class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
      title="Font settings"
    >
      <icon-lucide-settings class="size-3.5" />
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="left"
        :side-offset="8"
        align="start"
        :collision-padding="16"
        :avoid-collisions="true"
        :class="cls.content"
      >
        <div class="flex flex-col gap-3">
          <div>
            <h3 class="text-[11px] font-semibold text-surface">Fonts</h3>
            <p class="mt-1 text-[10px] leading-relaxed text-muted">
              Manage local font access and OpenPencil's downloaded fallback font cache.
            </p>
          </div>

          <div class="rounded border border-border bg-input/40 p-2 text-[10px] text-muted">
            <div class="flex justify-between gap-3">
              <span>Local access</span>
              <span class="text-surface">{{ accessState }}</span>
            </div>
            <div class="mt-1 flex justify-between gap-3">
              <span>Downloaded cache</span>
              <span class="text-surface">{{ cacheCount }} fonts · {{ cacheSize }}</span>
            </div>
            <div class="mt-1 flex justify-between gap-3">
              <span>Updated</span>
              <span class="text-surface">{{ cacheUpdatedLabel }}</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              data-test-id="font-settings-request-access"
              class="rounded bg-input px-2 py-1.5 text-[10px] font-medium text-surface hover:bg-hover disabled:opacity-50"
              :disabled="busyAction !== null"
              @click="requestAccess"
            >
              {{ busyAction === 'access' ? 'Requesting…' : 'Local fonts' }}
            </button>
            <button
              type="button"
              data-test-id="font-settings-download-fallbacks"
              class="rounded bg-accent px-2 py-1.5 text-[10px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              :disabled="busyAction !== null"
              @click="downloadFallbacks"
            >
              {{ busyAction === 'download' ? 'Downloading…' : 'Download fallbacks' }}
            </button>
            <button
              type="button"
              data-test-id="font-settings-refresh-cache"
              class="rounded bg-input px-2 py-1.5 text-[10px] font-medium text-surface hover:bg-hover disabled:opacity-50"
              :disabled="busyAction !== null"
              @click="refreshSummary"
            >
              Refresh
            </button>
            <button
              type="button"
              data-test-id="font-settings-clear-cache"
              class="rounded bg-input px-2 py-1.5 text-[10px] font-medium text-surface hover:bg-hover disabled:opacity-50"
              :disabled="busyAction !== null || cacheCount === 0"
              @click="clearCache"
            >
              Clear cache
            </button>
          </div>

          <p v-if="status" class="text-[10px] leading-relaxed text-muted">{{ status }}</p>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
