<script setup lang="ts">
import { isTextUIPart, isToolUIPart } from 'ai'
import { computed, inject } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { subagentTranscript } from '@/app/ai/chat/subagents'
import { toolDisplayName, type ChatMessagePart } from '@/app/ai/chat/tool-calls/display'
import { chatSubagentTheme } from '@/components/chat/ui'

import { OPEN_SUBAGENT_THREAD } from './context'
import { subagentStateLabel } from './state'

/**
 * A subagent the agent started, where it started: its name, what it does now, and its state.
 * It opens the subagent's own thread.
 */
/** `part`: the reply's part for the subagent. */
const { part } = defineProps<{ part: ChatMessagePart }>()

const { ai } = useI18n()
const ui = chatSubagentTheme()
const open = inject(OPEN_SUBAGENT_THREAD, null)
const transcript = computed(() => subagentTranscript(part))

const name = computed(
  () => transcript.value?.title ?? transcript.value?.description ?? ai.value.subagent
)
/** Its latest step: the last line it wrote, or the call it made last. */
const activity = computed(() => {
  const latest = transcript.value?.parts.findLast(
    (item) => isTextUIPart(item) || isToolUIPart(item)
  )
  if (!latest) return transcript.value?.title ? transcript.value.description : undefined
  if (isToolUIPart(latest)) return toolDisplayName(latest)
  return isTextUIPart(latest) ? latest.text.trim().split('\n').at(-1) : undefined
})
const state = computed(() => ai.value[subagentStateLabel(transcript.value?.state)])
const working = computed(() => {
  const current = transcript.value?.state
  return current === undefined || current === 'running'
})
</script>

<template>
  <button
    v-if="transcript"
    type="button"
    :class="ui.card()"
    :disabled="!open"
    data-test-id="chat-subagent-card"
    @click="open?.(transcript.session)"
  >
    <icon-lucide-bot :class="ui.icon()" aria-hidden="true" />
    <span :class="ui.body()">
      <span :class="ui.title()">{{ name }}</span>
      <span v-if="activity" :class="ui.activity()">{{ activity }}</span>
    </span>
    <span :class="ui.state()">
      <icon-lucide-loader-circle v-if="working" :class="ui.spinner()" aria-hidden="true" />
      {{ state }}
    </span>
    <icon-lucide-chevron-right data-direction="reading" :class="ui.chevron()" aria-hidden="true" />
  </button>
</template>
