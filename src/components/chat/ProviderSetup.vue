<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'
import { ref } from 'vue'

import { selectContent, selectItem, selectTrigger } from '@/components/ui/select'
import { AI_PROVIDERS, useAIChat } from '@/composables/use-chat'

const { providerId, providerDef, setApiKey, customBaseUrl, customModelId } = useAIChat()

const keyInput = ref('')
const baseUrlInput = ref(customBaseUrl.value)
const customModelInput = ref(customModelId.value)

function save() {
  const key = keyInput.value.trim()
  if (!key) return
  if (providerDef.value.supportsCustomBaseUrl) {
    customBaseUrl.value = baseUrlInput.value.trim()
  }
  if (providerDef.value.supportsCustomModel) {
    customModelId.value = customModelInput.value.trim()
  }
  setApiKey(key)
  keyInput.value = ''
}
</script>

<template>
  <div
    data-test-id="provider-setup"
    class="flex flex-1 flex-col items-center justify-center gap-4 px-4"
  >
    <icon-lucide-sparkles class="size-8 text-muted" />
    <p class="text-center text-xs text-muted">Connect an AI provider to start chatting.</p>

    <!-- Provider selector -->
    <SelectRoot v-model="providerId" class="w-full">
      <SelectTrigger
        data-test-id="provider-selector"
        :class="
          selectTrigger({
            class:
              'w-full justify-between rounded border border-border bg-input px-2.5 py-1.5 text-xs text-surface'
          })
        "
      >
        {{ providerDef.name }}
        <icon-lucide-chevron-down class="size-3 text-muted" />
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          position="popper"
          :side-offset="4"
          :class="selectContent({ radius: 'lg', padding: 'md' })"
        >
          <SelectViewport>
            <SelectItem
              v-for="provider in AI_PROVIDERS"
              :key="provider.id"
              :value="provider.id"
              :class="selectItem({ class: 'rounded px-2 py-1.5 text-[11px]' })"
            >
              <SelectItemText>{{ provider.name }}</SelectItemText>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>

    <!-- Base URL (OpenAI-compatible only) -->
    <input
      v-if="providerDef.supportsCustomBaseUrl"
      v-model="baseUrlInput"
      type="text"
      data-test-id="provider-base-url"
      placeholder="Base URL (e.g. http://localhost:11434/v1)"
      class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface outline-none focus:border-accent"
    />

    <!-- Custom model ID (OpenAI-compatible only) -->
    <input
      v-if="providerDef.supportsCustomModel"
      v-model="customModelInput"
      type="text"
      data-test-id="provider-custom-model"
      placeholder="Model ID (e.g. llama-3.3-70b)"
      class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface outline-none focus:border-accent"
    />

    <!-- API key input -->
    <form class="flex w-full gap-1.5" @submit.prevent="save">
      <input
        v-model="keyInput"
        type="password"
        data-test-id="api-key-input"
        :placeholder="providerDef.keyPlaceholder"
        class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface outline-none focus:border-accent"
      />
      <button
        type="submit"
        data-test-id="api-key-save"
        class="shrink-0 rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent/90"
        :disabled="!keyInput.trim()"
      >
        Save
      </button>
    </form>

    <a
      v-if="providerDef.keyUrl"
      :href="providerDef.keyUrl"
      target="_blank"
      data-test-id="api-key-get-link"
      class="text-[10px] text-muted underline hover:text-surface"
    >
      Get a {{ providerDef.name }} API key →
    </a>

    <p
      v-if="providerId === 'openrouter'"
      class="text-center text-[10px] leading-relaxed text-muted/70"
    >
      OpenRouter gives you access to 100+ models from all providers with a single API key.
    </p>
  </div>
</template>
