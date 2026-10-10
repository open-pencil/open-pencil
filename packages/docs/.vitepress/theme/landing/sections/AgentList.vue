<script setup lang="ts">
import type { Component } from 'vue'
import IconClaude from '~icons/simple-icons/claude'
import IconCursor from '~icons/simple-icons/cursor'
import IconGemini from '~icons/simple-icons/googlegemini'
import IconOpenAI from '~icons/simple-icons/openai'
import IconWindsurf from '~icons/simple-icons/windsurf'

import { AGENTS } from '../content/features'
import { useLandingMessages } from '../content/messages'

const messages = useLandingMessages()

const ICONS: Record<(typeof AGENTS)[number], Component> = {
  'Claude Code': IconClaude,
  Cursor: IconCursor,
  Windsurf: IconWindsurf,
  Codex: IconOpenAI,
  'Gemini CLI': IconGemini
}
</script>

<template>
  <div class="agents">
    <h3>{{ messages.agents.heading }}</h3>
    <ul>
      <li v-for="agent in AGENTS" :key="agent">
        <component :is="ICONS[agent]" aria-hidden="true" />{{ agent }}
      </li>
      <li class="rest">{{ messages.agents.rest }}</li>
    </ul>
  </div>
</template>

<style scoped>
h3 {
  color: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 600;
}

ul {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
  color: var(--vp-c-text-1);
  font-size: 14px;
  line-height: 20px;
}

li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rest {
  color: var(--vp-c-text-2);
}

svg {
  flex: none;
  width: 18px;
  height: 18px;
}
</style>
