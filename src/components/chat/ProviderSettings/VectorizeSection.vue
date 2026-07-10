<script setup lang="ts">
import { computed, toValue } from 'vue'

import { useI18n } from '@open-pencil/vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import ProviderSettingsKeyField from '@/components/chat/ProviderSettings/ProviderSettingsKeyField.vue'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()

const providerOptions = [
  { value: 'recraft' as const, label: 'Recraft' },
  { value: 'fal' as const, label: 'fal' }
]

const activeKey = computed({
  get: () => (ctx.vectorizeProvider === 'fal' ? ctx.falKeyInput : ctx.recraftKeyInput),
  set: (value: string) => {
    if (ctx.vectorizeProvider === 'fal') ctx.falKeyInput = value
    else ctx.recraftKeyInput = value
  }
})

const activeSaved = computed(() =>
  ctx.vectorizeProvider === 'fal' ? !!ctx.falApiKey : !!ctx.recraftApiKey
)

const activeHasExisting = computed(() =>
  ctx.vectorizeProvider === 'fal' ? ctx.hasExistingFalKey : ctx.hasExistingRecraftKey
)

const activeKeyUrl = computed(() =>
  ctx.vectorizeProvider === 'fal'
    ? 'https://fal.ai/dashboard/keys'
    : 'https://www.recraft.ai/account/api'
)

const dialogText = computed(() => toValue(dialogs))

const activeKeyUrlLabel = computed(() =>
  ctx.vectorizeProvider === 'fal'
    ? dialogText.value.getFalAPIKey
    : dialogText.value.getRecraftAPIKey
)

const activeLabel = computed(() =>
  ctx.vectorizeProvider === 'fal' ? dialogText.value.falAPIKey : dialogText.value.recraftAPIKey
)

const activeClear = computed(() =>
  ctx.vectorizeProvider === 'fal' ? ctx.clearFalKey : ctx.clearRecraftKey
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <h4 class="text-[11px] font-semibold text-surface">{{ dialogText.vectorizeProvider }}</h4>
    <AppSelect
      v-model="ctx.vectorizeProvider"
      data-test-id="provider-settings-vectorize-provider"
      :options="providerOptions"
      :ui="{
        trigger:
          'w-full justify-between rounded border border-border bg-input px-2.5 py-1.5 text-xs text-surface',
        item: 'rounded px-2 py-1.5 text-[11px]'
      }"
      @update:model-value="ctx.save"
    />
    <ProviderSettingsKeyField
      v-model="activeKey"
      :label="activeLabel"
      :saved="activeSaved"
      :kind="ctx.vectorizeProvider"
      :placeholder="
        activeHasExisting ? dialogText.keySavedReplace : dialogText.vectorizeKeyOptional
      "
      :key-url="activeKeyUrl"
      :key-url-label="activeKeyUrlLabel"
      @clear="activeClear"
      @change="ctx.saveVectorizeKeys"
    />
  </div>
</template>
