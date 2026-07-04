<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  testProviderConnection,
  type ProviderConnectionTestFailureReason
} from '@/app/ai/chat/connection-test'
import ProviderConnectionTestButton from '@/components/chat/ProviderConnectionTestButton.vue'
import ProviderSelectField from '@/components/chat/ProviderSelect/ProviderSelectField.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppTextButton from '@/components/ui/AppTextButton.vue'
import { useAIChat } from '@/app/ai/chat/use'
import { ACP_AGENTS } from '@open-pencil/core/constants'
import { openExternalLink } from '@/app/shell/ui'
import { useI18n } from '@open-pencil/vue'

const { providerID, providerDef, setAPIKey, modelID, customBaseURL, customModelID, customAPIType } =
  useAIChat()
const { dialogs } = useI18n()

const isACP = computed(() => providerID.value.startsWith('acp:'))
const acpAgent = computed(() => {
  if (!isACP.value) return null
  const id = providerID.value.replace('acp:', '')
  return ACP_AGENTS.find((a) => a.id === id) ?? null
})

const keyInput = ref('')
const baseURLInput = ref(customBaseURL.value)
const customModelInput = ref(customModelID.value)
const connectionTestStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
const connectionTestReason = ref<ProviderConnectionTestFailureReason | null>(null)

const canTestConnection = computed(() => {
  if (isACP.value) return false
  if (!keyInput.value.trim()) return false
  if (providerDef.value.supportsCustomBaseURL && !baseURLInput.value.trim()) return false
  if (
    providerDef.value.supportsCustomModel &&
    providerID.value !== 'openrouter' &&
    providerID.value !== 'requesty' &&
    !customModelInput.value.trim()
  ) {
    return false
  }
  return true
})

function resetConnectionTest() {
  connectionTestStatus.value = 'idle'
  connectionTestReason.value = null
}

watch([providerID, keyInput, baseURLInput, customModelInput, customAPIType], resetConnectionTest)

async function testConnection() {
  if (connectionTestStatus.value === 'testing') return
  connectionTestStatus.value = 'testing'
  connectionTestReason.value = null

  const result = await testProviderConnection({
    providerID: providerID.value,
    apiKey: keyInput.value.trim(),
    modelID: modelID.value,
    customModelID: providerDef.value.supportsCustomModel
      ? customModelInput.value.trim()
      : customModelID.value,
    customBaseURL: providerDef.value.supportsCustomBaseURL
      ? baseURLInput.value.trim()
      : customBaseURL.value,
    customAPIType: customAPIType.value
  })

  if (result.ok) {
    connectionTestStatus.value = 'success'
    connectionTestReason.value = null
    return
  }

  connectionTestStatus.value = 'error'
  connectionTestReason.value = result.reason
}

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
    <p class="mb-5 text-center text-xs text-muted">{{ dialogs.connectAIProvider }}</p>

    <form v-if="!isACP" class="flex w-full flex-col gap-2" @submit.prevent="save">
      <ProviderSelectField data-test-id="provider-selector" />

      <!-- Base URL (compatible providers only) -->
      <AppInput
        v-if="providerDef.supportsCustomBaseURL"
        v-model="baseURLInput"
        data-test-id="provider-base-url"
        :placeholder="dialogs.baseURLPlaceholder"
      />

      <!-- Optional custom model ID for providers that support arbitrary model IDs. -->
      <AppInput
        v-if="providerDef.supportsCustomModel && providerID !== 'openrouter' && providerID !== 'requesty'"
        v-model="customModelInput"
        data-test-id="provider-custom-model"
        :placeholder="dialogs.modelIDPlaceholder"
      />

      <AppInput
        v-model="keyInput"
        type="password"
        data-test-id="api-key-input"
        :placeholder="providerDef.keyPlaceholder"
      />

      <ProviderConnectionTestButton
        :status="connectionTestStatus"
        :reason="connectionTestReason"
        :disabled="!canTestConnection"
        @test="testConnection"
      />

      <button
        type="submit"
        data-test-id="api-key-save"
        class="mt-1 w-full rounded bg-accent py-1.5 text-xs font-medium text-white hover:bg-accent/90"
        :disabled="!keyInput.trim()"
      >
        {{ dialogs.connect }}
      </button>
    </form>

    <!-- ACP agent — no API key needed -->
    <div v-else class="flex w-full flex-col gap-2">
      <ProviderSelectField data-test-id="provider-selector" />

      <p class="text-center text-[10px] leading-relaxed text-muted">
        Uses your existing {{ acpAgent?.name }} subscription.
        <template v-if="acpAgent?.installCommand">
          Install it with
          <code class="rounded bg-input px-1 py-0.5 font-mono text-[9px]">{{
            acpAgent.installCommand
          }}</code>
          and sign in before sending your first message.
        </template>
        <template v-else>
          Make sure
          <code class="rounded bg-input px-1 py-0.5 font-mono text-[9px]">{{
            acpAgent?.command
          }}</code>
          is installed and authenticated.
        </template>
      </p>
    </div>

    <AppTextButton
      v-if="!isACP && providerDef.keyURL"
      data-test-id="api-key-get-link"
      underline
      :ui="{ base: 'mt-2.5' }"
      @click="openExternalLink(providerDef.keyURL as string)"
    >
      {{ dialogs.getAPIKey({ provider: providerDef.name }) }}
    </AppTextButton>

    <p
      v-if="providerID === 'openrouter'"
      class="mt-3 text-center text-[10px] leading-relaxed text-muted/50"
    >
      {{ dialogs.oneKeyManyModels }}
    </p>
  </div>
</template>
