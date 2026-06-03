<script setup lang="ts">
import { useI18n } from '@inkly/vue'

import ProviderSettingsKeyField from '@/components/chat/ProviderSettings/ProviderSettingsKeyField.vue'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()
</script>

<template>
  <ProviderSettingsKeyField
    v-model="ctx.pexelsKeyInput"
    :label="dialogs.pexelsAPIKey"
    :saved="!!ctx.pexelsApiKey"
    clear-test-id="provider-settings-clear-pexels-key"
    input-test-id="provider-settings-pexels-key"
    :placeholder="
      ctx.hasExistingPexelsKey ? dialogs.keySavedReplace : dialogs.stockPhotoToolOptional
    "
    key-url="https://www.pexels.com/api/"
    :key-url-label="dialogs.getPexelsAPIKey"
    @clear="ctx.clearPexelsKey"
    @change="ctx.save"
  />

  <ProviderSettingsKeyField
    v-model="ctx.unsplashKeyInput"
    :label="dialogs.unsplashAccessKey"
    :saved="!!ctx.unsplashAccessKey"
    clear-test-id="provider-settings-clear-unsplash-key"
    input-test-id="provider-settings-unsplash-key"
    :placeholder="
      ctx.hasExistingUnsplashKey ? dialogs.keySavedReplace : dialogs.pexelsAlternativeOptional
    "
    key-url="https://unsplash.com/oauth/applications"
    :key-url-label="dialogs.getUnsplashAccessKey"
    @clear="ctx.clearUnsplashKey"
    @change="ctx.save"
  />
</template>
