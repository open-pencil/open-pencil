<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

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
    kind="pexels"
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
    kind="unsplash"
    :placeholder="
      ctx.hasExistingUnsplashKey ? dialogs.keySavedReplace : dialogs.pexelsAlternativeOptional
    "
    key-url="https://unsplash.com/oauth/applications"
    :key-url-label="dialogs.getUnsplashAccessKey"
    @clear="ctx.clearUnsplashKey"
    @change="ctx.save"
  />
</template>
