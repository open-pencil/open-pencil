<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'
import IconAnthropic from '~icons/ai/anthropic'
import IconClaudeCode from '~icons/ai/claudecode'
import IconCodex from '~icons/ai/codex'
import IconDeepSeek from '~icons/ai/deepseek'
import IconGemini from '~icons/ai/gemini'
import IconGeminiCLI from '~icons/ai/geminicli'
import IconLMStudio from '~icons/ai/lmstudio'
import IconMiniMax from '~icons/ai/minimax'
import IconOllama from '~icons/ai/ollama'
import IconOpenAI from '~icons/ai/openai'
import IconOpenRouter from '~icons/ai/openrouter'
import IconZai from '~icons/ai/zai'
import IconBot from '~icons/lucide/bot'
import IconServer from '~icons/lucide/server'

/** A provider, agent, or server preset such as `ollama`. */
const { provider } = defineProps<{ provider: string }>()

const LOGOS: Record<string, Component> = {
  anthropic: IconAnthropic,
  openai: IconOpenAI,
  google: IconGemini,
  openrouter: IconOpenRouter,
  deepseek: IconDeepSeek,
  zai: IconZai,
  minimax: IconMiniMax,
  ollama: IconOllama,
  lmstudio: IconLMStudio,
  'acp:claude-code': IconClaudeCode,
  'acp:codex': IconCodex,
  'acp:gemini-cli': IconGeminiCLI,
  'harness:pi': IconBot
}

const logo = computed(() => LOGOS[provider] ?? IconServer)
</script>

<template>
  <component :is="logo" class="size-4 shrink-0" aria-hidden="true" data-slot="provider-logo" />
</template>
