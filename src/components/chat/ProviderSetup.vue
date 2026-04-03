<script setup lang="ts">
import { computed, ref } from 'vue'

import ProviderSelectField from '@/components/chat/ProviderSelectField.vue'
import { uiInput } from '@/components/ui/input'
import { useAIChat } from '@/composables/use-chat'
import { ACP_AGENTS } from '@open-pencil/core'
import { useI18n } from '@open-pencil/vue'

const { providerID, providerDef, setAPIKey, customBaseURL, customModelID } = useAIChat()
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
      <ProviderSelectField test-id="provider-selector" />

      <!-- Base URL (OpenAI-compatible only) -->
      <input
        v-if="providerDef.supportsCustomBaseURL"
        v-model="baseURLInput"
        type="text"
        data-test-id="provider-base-url"
        :placeholder="dialogs.baseURLPlaceholder"
        :class="uiInput()"
      />

      <!-- Custom model ID (OpenAI-compatible only) -->
      <input
        v-if="providerDef.supportsCustomModel"
        v-model="customModelInput"
        type="text"
        data-test-id="provider-custom-model"
        :placeholder="dialogs.modelIDPlaceholder"
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
        {{ dialogs.connect }}
      </button>
    </form>

    <!-- ACP agent — no API key needed -->
    <div v-else class="flex w-full flex-col gap-2">
      <ProviderSelectField test-id="provider-selector" />

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

    <a
      v-if="!isACP && providerDef.keyURL"
      :href="providerDef.keyURL"
      target="_blank"
      data-test-id="api-key-get-link"
      class="mt-2.5 text-[10px] text-muted underline hover:text-surface"
    >
      {{ dialogs.getAPIKey({ provider: providerDef.name }) }}
    </a>

    <p
      v-if="providerID === 'openrouter'"
      class="mt-3 text-center text-[10px] leading-relaxed text-muted/50"
    >
      {{ dialogs.oneKeyManyModels }}
    </p>
  </div>
</template>
