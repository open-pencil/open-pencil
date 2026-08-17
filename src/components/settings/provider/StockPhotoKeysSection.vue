<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@open-pencil/vue'

import { useAIChat } from '@/app/ai/chat/use'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'

const { dialogs } = useI18n()
const { pexelsKeyStatus, setPexelsKey, unsplashKeyStatus, setUnsplashKey } = useAIChat()
const pexelsKeyInput = ref('')
const unsplashKeyInput = ref('')
const hasExistingPexelsKey = computed(() => pexelsKeyStatus.value === 'configured')
const hasExistingUnsplashKey = computed(() => unsplashKeyStatus.value === 'configured')

async function savePexelsKey(): Promise<void> {
  const value = pexelsKeyInput.value.trim()
  if (!value) return
  await setPexelsKey(value)
  pexelsKeyInput.value = ''
}

async function saveUnsplashKey(): Promise<void> {
  const value = unsplashKeyInput.value.trim()
  if (!value) return
  await setUnsplashKey(value)
  unsplashKeyInput.value = ''
}

async function clearPexelsKey(): Promise<void> {
  await setPexelsKey('')
  pexelsKeyInput.value = ''
}

async function clearUnsplashKey(): Promise<void> {
  await setUnsplashKey('')
  unsplashKeyInput.value = ''
}
</script>

<template>
  <ProviderSettingsKeyField
    v-model="pexelsKeyInput"
    :label="dialogs.pexelsAPIKey"
    :saved="hasExistingPexelsKey"
    kind="pexels"
    :placeholder="hasExistingPexelsKey ? dialogs.keySavedReplace : dialogs.stockPhotoToolOptional"
    key-u-r-l="https://www.pexels.com/api/"
    :key-u-r-l-label="dialogs.getPexelsAPIKey"
    @clear="clearPexelsKey"
    @change="savePexelsKey"
  />

  <ProviderSettingsKeyField
    v-model="unsplashKeyInput"
    :label="dialogs.unsplashAccessKey"
    :saved="hasExistingUnsplashKey"
    kind="unsplash"
    :placeholder="
      hasExistingUnsplashKey ? dialogs.keySavedReplace : dialogs.pexelsAlternativeOptional
    "
    key-u-r-l="https://unsplash.com/oauth/applications"
    :key-u-r-l-label="dialogs.getUnsplashAccessKey"
    @clear="clearUnsplashKey"
    @change="saveUnsplashKey"
  />
</template>
