<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from '@open-pencil/vue'

import {
  setVectorizeCredential,
  vectorizeCredentialStatus,
  vectorizeProviderID,
  VECTORIZE_PROVIDER_DEFINITIONS
} from '@/app/editor/vectorize'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const { dialogs } = useI18n()
const keyDraft = ref('')
const keyStatus = ref<'configured' | 'missing' | 'unavailable' | 'locked'>('missing')
const provider = computed(() =>
  VECTORIZE_PROVIDER_DEFINITIONS.find((definition) => definition.id === vectorizeProviderID.value)
)
const providerOptions = VECTORIZE_PROVIDER_DEFINITIONS.map((definition) => ({
  value: definition.id,
  label: definition.name
}))

async function refreshStatus(): Promise<void> {
  const providerID = vectorizeProviderID.value
  const status = await vectorizeCredentialStatus(providerID)
  if (vectorizeProviderID.value === providerID) keyStatus.value = status
}

async function saveCredential(): Promise<void> {
  if (!keyDraft.value.trim()) return
  await setVectorizeCredential(vectorizeProviderID.value, keyDraft.value)
  keyDraft.value = ''
  await refreshStatus()
}

async function clearCredential(): Promise<void> {
  await setVectorizeCredential(vectorizeProviderID.value, '')
  keyDraft.value = ''
  await refreshStatus()
}

watch(vectorizeProviderID, () => {
  keyDraft.value = ''
  void refreshStatus()
})

onMounted(() => void refreshStatus())
</script>

<template>
  <section class="flex flex-col gap-2.5 border-t border-border pt-3" data-vectorize-settings>
    <div>
      <h3 class="text-xs font-semibold text-surface">{{ dialogs.vectorization }}</h3>
      <p class="mt-0.5 text-[10px] text-muted">{{ dialogs.vectorizationDescription }}</p>
    </div>

    <label class="flex flex-col gap-1 text-[10px] text-muted">
      {{ dialogs.vectorizeProvider }}
      <AppSelect
        v-model="vectorizeProviderID"
        :label="dialogs.vectorizeProvider"
        :options="providerOptions"
      />
    </label>

    <ProviderSettingsKeyField
      v-if="provider"
      v-model="keyDraft"
      :label="dialogs.apiKey"
      :saved="keyStatus === 'configured'"
      kind="api"
      :placeholder="keyStatus === 'configured' ? dialogs.keySavedReplace : provider.keyPlaceholder"
      :key-u-r-l="provider.keyURL"
      :key-u-r-l-label="dialogs.getAPIKeyGeneric"
      @change="saveCredential"
      @clear="clearCredential"
    />
  </section>
</template>
