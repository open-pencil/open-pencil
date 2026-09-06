<script setup lang="ts">
import { useVectorizeSettings } from '@/app/editor/vectorize/settings/use'

import { ref } from 'vue'
import { useI18n } from '@open-pencil/vue'

import { vectorizeProviderID } from '@/app/editor/vectorize'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const { media, ai, credentials } = useI18n()
const keyDraft = ref('')

const { keyStatus, error, provider, providerOptions, saveCredential, clearCredential } =
  useVectorizeSettings(keyDraft)
</script>

<template>
  <section class="flex flex-col gap-2.5 border-t border-border pt-3" data-vectorize-settings>
    <div>
      <h3 class="text-xs font-semibold text-surface">{{ media.vectorization }}</h3>
      <p class="mt-0.5 text-[10px] text-muted">{{ media.vectorizationDescription }}</p>
    </div>

    <label class="flex flex-col gap-1 text-[10px] text-muted">
      {{ media.vectorizeProvider }}
      <AppSelect
        v-model="vectorizeProviderID"
        :label="media.vectorizeProvider"
        :options="providerOptions"
      />
    </label>

    <ProviderSettingsKeyField
      v-if="provider"
      v-model="keyDraft"
      :label="ai.apiKey"
      :saved="keyStatus === 'configured'"
      kind="api"
      :placeholder="keyStatus === 'configured' ? credentials.savedReplace : provider.keyPlaceholder"
      :key-u-r-l="provider.keyURL"
      :key-u-r-l-label="credentials.getAPIKey"
      @change="saveCredential"
      @clear="clearCredential"
    />
    <p v-if="error" role="alert" class="text-[10px] text-danger">{{ error }}</p>
  </section>
</template>
