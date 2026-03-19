<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ProviderSelect from '@/components/chat/ProviderSelect.vue'
import { uiInput } from '@/components/ui/input'
import { useAIChat } from '@/composables/use-chat'
import { ACP_AGENTS } from '@open-pencil/core'

const { t } = useI18n()
const { providerID, providerDef, setAPIKey, customBaseURL, customModelID } = useAIChat()

const isACP = computed(() => providerID.value.startsWith('acp:'))
const acpAgent = computed(() => {
  if (!isACP.value) return null
  const id = providerID.value.replace('acp:', '')
  return ACP_AGENTS.find((a) => a.id === id) ?? null
})

const keyInput = ref('')
const baseURLInput = ref(customBaseURL.value)
const customModelInput = ref(customModelID.value)

function save() {
  const key = keyInput.value.trim()
  if (!key) return
  if (providerDef.value.supportsCustomBaseURL) {
    customBaseURL.value = baseURLInput.value.trim()
  }
  if (providerDef.value.supportsCustomModel) {
    customModelID.value = customModelInput.value.trim()
  }
  setAPIKey(key)
  keyInput.value = ''
}
</script>

<template>
  <div data-test-id="provider-setup" class="flex flex-1 flex-col items-center justify-center px-6">
    <icon-lucide-sparkles class="mb-3 size-7 text-muted" />
    <p class="mb-5 text-center text-xs text-muted">{{ t('chat.connectProvider') }}</p>

    <form v-if="!isACP" class="flex w-full flex-col gap-2" @submit.prevent="save">
      <ProviderSelect
        test-id="provider-selector"
        trigger-class="w-full justify-between rounded border border-border bg-input px-2.5 py-1.5 text-xs text-surface"
        item-class="rounded px-2 py-1.5 text-[11px]"
      />

      <!-- Base URL (OpenAI-compatible only) -->
      <input
        v-if="providerDef.supportsCustomBaseURL"
        v-model="baseURLInput"
        type="text"
        data-test-id="provider-base-url"
        :placeholder="t('chat.baseURL') + ' (e.g. http://localhost:11434/v1)'"
        :class="uiInput()"
      />

      <!-- Custom model ID (OpenAI-compatible only) -->
      <input
        v-if="providerDef.supportsCustomModel"
        v-model="customModelInput"
        type="text"
        data-test-id="provider-custom-model"
        :placeholder="t('chat.modelId') + ' (e.g. llama-3.3-70b)'"
        :class="uiInput()"
      />

      <input
        v-model="keyInput"
        type="password"
        data-test-id="api-key-input"
        :placeholder="providerDef.keyPlaceholder"
        :class="uiInput()"
      />

      <button
        type="submit"
        data-test-id="api-key-save"
        class="mt-1 w-full rounded bg-accent py-1.5 text-xs font-medium text-white hover:bg-accent/90"
        :disabled="!keyInput.trim()"
      >
        {{ t('chat.connect') }}
      </button>
    </form>

    <!-- ACP agent — no API key needed -->
    <div v-else class="flex w-full flex-col gap-2">
      <ProviderSelect
        test-id="provider-selector"
        trigger-class="w-full justify-between rounded border border-border bg-input px-2.5 py-1.5 text-xs text-surface"
        item-class="rounded px-2 py-1.5 text-[11px]"
      />

      <p class="text-center text-[10px] leading-relaxed text-muted">
        {{ t('chat.usesSubscription', { agent: acpAgent?.name }) }}
        <code class="rounded bg-input px-1 py-0.5 font-mono text-[9px]">{{
          acpAgent?.command
        }}</code>
        {{ t('chat.isInstalledAuth') }}
      </p>
    </div>

    <a
      v-if="!isACP && providerDef.keyURL"
      :href="providerDef.keyURL"
      target="_blank"
      data-test-id="api-key-get-link"
      class="mt-2.5 text-[10px] text-muted underline hover:text-surface"
    >
      {{ t('chat.getApiKeyLink', { provider: providerDef.name }) }}
    </a>

    <p
      v-if="providerID === 'openrouter'"
      class="mt-3 text-center text-[10px] leading-relaxed text-muted/50"
    >
      {{ t('chat.oneKeyModels') }}
    </p>
  </div>
</template>
