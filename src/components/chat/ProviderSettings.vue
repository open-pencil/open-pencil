<script setup lang="ts">
import {
  PopoverClose,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  TooltipContent,
  TooltipPortal,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'
import { ref, watch } from 'vue'

import ProviderSelect from '@/components/chat/ProviderSelect.vue'
import { uiInput } from '@/components/ui/input'
import { useAIChat } from '@/composables/use-chat'

const { providerID, providerDef, apiKey, setAPIKey, customBaseURL, customModelID } = useAIChat()

const keyInput = ref('')
const baseURLInput = ref(customBaseURL.value)
const customModelInput = ref(customModelID.value)
const hasExistingKey = ref(!!apiKey.value)

watch(providerID, () => {
  keyInput.value = ''
  hasExistingKey.value = !!apiKey.value
  baseURLInput.value = customBaseURL.value
  customModelInput.value = customModelID.value
})

function save() {
  if (keyInput.value.trim()) {
    setAPIKey(keyInput.value.trim())
    hasExistingKey.value = true
    keyInput.value = ''
  }
  if (providerDef.value.supportsCustomBaseURL) {
    customBaseURL.value = baseURLInput.value.trim()
  }
  if (providerDef.value.supportsCustomModel) {
    customModelID.value = customModelInput.value.trim()
  }
}

function clearKey() {
  setAPIKey('')
  keyInput.value = ''
  hasExistingKey.value = false
}
</script>

<template>
  <PopoverRoot>
    <TooltipRoot>
      <TooltipTrigger as-child>
        <PopoverTrigger
          data-test-id="provider-settings-trigger"
          class="rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
        >
          <icon-lucide-settings class="size-3" />
        </PopoverTrigger>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          side="top"
          :side-offset="4"
          class="rounded bg-surface px-2 py-1 text-[10px] text-canvas"
        >
          Provider settings
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>

    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="8"
        align="end"
        class="z-50 w-64 rounded-lg border border-border bg-panel p-3 shadow-lg"
        @interact-outside="save"
      >
        <div class="flex flex-col gap-2.5">
          <h3 class="text-[11px] font-semibold text-surface">AI Provider</h3>

          <ProviderSelect test-id="provider-settings-provider" />

          <!-- Base URL (OpenAI-compatible only) -->
          <div v-if="providerDef.supportsCustomBaseURL" class="flex flex-col gap-1">
            <label class="text-[10px] text-muted">Base URL</label>
            <input
              v-model="baseURLInput"
              type="text"
              data-test-id="provider-settings-base-url"
              placeholder="http://localhost:11434/v1"
              :class="uiInput({ size: 'sm' })"
              @change="save"
            />
          </div>

          <!-- Custom model ID (OpenAI-compatible only) -->
          <div v-if="providerDef.supportsCustomModel" class="flex flex-col gap-1">
            <label class="text-[10px] text-muted">Model ID</label>
            <input
              v-model="customModelInput"
              type="text"
              data-test-id="provider-settings-custom-model"
              placeholder="e.g. llama-3.3-70b"
              :class="uiInput({ size: 'sm' })"
              @change="save"
            />
          </div>

          <!-- API key -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <label class="text-[10px] text-muted">API Key</label>
              <button
                v-if="apiKey"
                class="cursor-pointer text-[10px] text-muted hover:text-surface"
                data-test-id="provider-settings-clear-key"
                @click="clearKey"
              >
                Clear
              </button>
            </div>
            <input
              v-model="keyInput"
              type="password"
              data-test-id="provider-settings-api-key"
              :placeholder="
                hasExistingKey ? 'Key saved — enter new to replace' : providerDef.keyPlaceholder
              "
              :class="uiInput({ size: 'sm' })"
              @change="save"
            />
            <a
              v-if="providerDef.keyURL"
              :href="providerDef.keyURL"
              target="_blank"
              class="text-[9px] text-muted underline hover:text-surface"
            >
              Get API key →
            </a>
          </div>

          <PopoverClose
            class="mt-1 w-full rounded bg-accent px-2 py-1 text-center text-[11px] font-medium text-white hover:bg-accent/90"
            data-test-id="provider-settings-done"
            @click="save"
          >
            Done
          </PopoverClose>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
