<script setup lang="ts">
import { openExternalLink } from '@/app/shell/ui'
import { useInputUI } from '@/components/ui/input'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between">
      <label class="text-[10px] text-muted">Pexels API Key (stock photos)</label>
      <button
        v-if="ctx.pexelsApiKey"
        class="cursor-pointer text-[10px] text-muted hover:text-surface"
        data-test-id="provider-settings-clear-pexels-key"
        @click="ctx.clearPexelsKey"
      >
        Clear
      </button>
    </div>
    <input
      v-model="ctx.pexelsKeyInput"
      type="password"
      data-test-id="provider-settings-pexels-key"
      :placeholder="
        ctx.hasExistingPexelsKey
          ? 'Key saved — enter new to replace'
          : 'Optional — for stock_photo tool'
      "
      :class="useInputUI({ size: 'sm' }).base"
      @change="ctx.save"
    />
    <button
      type="button"
      class="cursor-pointer text-[9px] text-muted underline hover:text-surface"
      @click="openExternalLink('https://www.pexels.com/api/')"
    >
      Get free Pexels API key →
    </button>
  </div>

  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between">
      <label class="text-[10px] text-muted">Unsplash Access Key</label>
      <button
        v-if="ctx.unsplashAccessKey"
        class="cursor-pointer text-[10px] text-muted hover:text-surface"
        data-test-id="provider-settings-clear-unsplash-key"
        @click="ctx.clearUnsplashKey"
      >
        Clear
      </button>
    </div>
    <input
      v-model="ctx.unsplashKeyInput"
      type="password"
      data-test-id="provider-settings-unsplash-key"
      :placeholder="
        ctx.hasExistingUnsplashKey
          ? 'Key saved — enter new to replace'
          : 'Optional — alternative to Pexels'
      "
      :class="useInputUI({ size: 'sm' }).base"
      @change="ctx.save"
    />
    <button
      type="button"
      class="cursor-pointer text-[9px] text-muted underline hover:text-surface"
      @click="openExternalLink('https://unsplash.com/oauth/applications')"
    >
      Get free Unsplash access key →
    </button>
  </div>
</template>
