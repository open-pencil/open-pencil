<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import ProviderSettingsKeyField from '@/components/chat/ProviderSettings/ProviderSettingsKeyField.vue'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()
</script>

<template>
  <ProviderSettingsKeyField
    v-if="!ctx.isACP"
    v-model="ctx.keyInput"
    :label="dialogs.apiKey"
    :saved="!!ctx.apiKey"
    kind="api"
    :placeholder="ctx.hasExistingKey ? dialogs.keySavedReplace : ctx.providerDef.keyPlaceholder"
    :key-url="ctx.providerDef.keyURL"
    :key-url-label="dialogs.getAPIKeyGeneric"
    @clear="ctx.clearKey"
    @change="ctx.save"
  />
</template>
