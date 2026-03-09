<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'

import ProviderSettings from '@/components/chat/ProviderSettings.vue'
import { uiButton } from '@/components/ui/button'
import { uiInput } from '@/components/ui/input'
import { selectContent, selectItem, selectTrigger } from '@/components/ui/select'
import { useAIChat } from '@/composables/use-chat'

const { providerID, providerDef, modelID, customModelID } = useAIChat()

const { status } = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
}>()

const emit = defineEmits<{
  submit: [text: string]
  stop: []
}>()

const input = ref('')

const isStreaming = computed(() => status === 'streaming' || status === 'submitted')
const isCustomProvider = computed(() => providerID.value === 'openai-compatible')

const selectedModelName = computed(() => {
  if (isCustomProvider.value) return customModelID.value || 'No model'
  return providerDef.value.models.find((m) => m.id === modelID.value)?.name ?? modelID.value
})

function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  emit('submit', text)
  input.value = ''
}
</script>

<template>
  <TooltipProvider>
    <div class="shrink-0 border-t border-border px-3 py-2">
      <!-- Model selector & settings -->
      <div class="mb-1.5 flex items-center gap-1">
        <template v-if="isCustomProvider">
          <div
            class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted"
            data-test-id="chat-custom-model-label"
          >
            <icon-lucide-bot class="size-3" />
            {{ selectedModelName }}
          </div>
        </template>
        <SelectRoot v-else v-model="modelID">
          <SelectTrigger
            data-test-id="chat-model-selector"
            :class="
              selectTrigger({
                class:
                  'gap-1 rounded border-none bg-transparent px-1.5 py-0.5 text-[10px] text-muted'
              })
            "
          >
            <icon-lucide-bot class="size-3" />
            {{ selectedModelName }}
            <icon-lucide-chevron-down class="size-2.5" />
          </SelectTrigger>
          <SelectPortal>
            <SelectContent
              position="popper"
              side="top"
              :side-offset="4"
              :class="
                selectContent({ radius: 'lg', padding: 'md', class: 'max-h-60 overflow-y-auto' })
              "
            >
              <SelectViewport>
                <SelectItem
                  v-for="model in providerDef.models"
                  :key="model.id"
                  :value="model.id"
                  :class="selectItem({ class: 'gap-2 rounded px-2 py-1.5 text-[11px]' })"
                >
                  <SelectItemText class="flex-1">{{ model.name }}</SelectItemText>
                  <span
                    v-if="model.tag"
                    class="rounded bg-accent/10 px-1 py-px text-[9px] text-accent"
                  >
                    {{ model.tag }}
                  </span>
                </SelectItem>
              </SelectViewport>
            </SelectContent>
          </SelectPortal>
        </SelectRoot>

        <div class="ml-auto">
          <ProviderSettings />
        </div>
      </div>

      <!-- Input form -->
      <form class="flex gap-1.5" @submit="handleSubmit">
        <input
          v-model="input"
          type="text"
          data-test-id="chat-input"
          placeholder="Describe a change…"
          :class="uiInput({ class: 'min-w-0 flex-1 placeholder:text-muted' })"
          :disabled="status === 'submitted'"
          @paste.stop
          @copy.stop
          @cut.stop
        />
        <TooltipRoot v-if="isStreaming">
          <TooltipTrigger as-child>
            <button
              type="button"
              data-test-id="chat-stop-button"
              :class="
                uiButton({
                  tone: 'ghost',
                  shape: 'rounded',
                  size: 'sm',
                  class: 'shrink-0 border border-border px-2 py-1.5'
                })
              "
              @click="emit('stop')"
            >
              <icon-lucide-square class="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              side="top"
              :side-offset="4"
              class="rounded bg-surface px-2 py-1 text-[10px] text-canvas"
            >
              Stop generating
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
        <TooltipRoot v-else>
          <TooltipTrigger as-child>
            <button
              type="submit"
              data-test-id="chat-send-button"
              :class="
                uiButton({
                  tone: 'accent',
                  shape: 'rounded',
                  size: 'sm',
                  class: 'shrink-0 px-2.5 py-1.5 font-medium'
                })
              "
              :disabled="!input.trim()"
            >
              <icon-lucide-send class="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              side="top"
              :side-offset="4"
              class="rounded bg-surface px-2 py-1 text-[10px] text-canvas"
            >
              Send message
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </form>
    </div>
  </TooltipProvider>
</template>
