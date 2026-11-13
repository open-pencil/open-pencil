<script setup lang="ts">
import { isTextUIPart, isToolUIPart } from 'ai'
import { computed, inject } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { subagentTranscript } from '@/app/ai/chat/subagents'
import { toolDisplayName, type ChatMessagePart } from '@/app/ai/chat/tool-calls/display'
import { chatSubagentTheme } from '@/components/chat/ui'

import ChatSubagentFollowButton from './ChatSubagentFollowButton.vue'
import { OPEN_SUBAGENT_THREAD } from './context'
import { subagentNames, subagentStateLabel } from './state'
import { useSubagentFollow } from './useSubagentFollow'

/**
 * A subagent the agent started, where it started: named and colored as its cursor on the canvas,
 * with what it does now and its state. It opens the subagent's own thread, and while the
 * subagent works its cursor can be followed from here.
 */
const { part } = defineProps<{ part: ChatMessagePart }>()

const { ai } = useI18n()
const ui = chatSubagentTheme()
const open = inject(OPEN_SUBAGENT_THREAD, null)
const transcript = computed(() => subagentTranscript(part))
const names = computed(() =>
  transcript.value ? subagentNames(transcript.value, ai.value.subagent) : null
)
/** Its latest step: the last line it wrote, or the call it made last. */
const activity = computed(() => {
  const latest = transcript.value?.parts.findLast(
    (item) => isTextUIPart(item) || isToolUIPart(item)
  )
  if (!latest) return undefined
  if (isToolUIPart(latest)) return toolDisplayName(latest)
  return isTextUIPart(latest) ? latest.text.trim().split('\n').at(-1) : undefined
})
const state = computed(() => ai.value[subagentStateLabel(transcript.value?.state)])
const working = computed(() => {
  const current = transcript.value?.state
  return current === undefined || current === 'running'
})
const follow = useSubagentFollow(() => transcript.value)
</script>

<template>
  <div v-if="transcript && names" :class="ui.card()" data-test-id="chat-subagent-card">
    <button type="button" :class="ui.open()" :disabled="!open" @click="open?.(transcript.session)">
      <icon-lucide-bot
        :class="ui.icon()"
        :style="transcript.agent ? { color: transcript.agent.color } : undefined"
        aria-hidden="true"
      />
      <span :class="ui.body()">
        <span :class="ui.names()">
          <span :class="ui.title()">{{ names.name }}</span>
          <span v-if="names.title" :class="ui.subtitle()">{{ names.title }}</span>
        </span>
        <!-- The line is always there, so the card keeps its height as steps come and go. -->
        <span :class="ui.activity()">{{ activity ?? (working ? ai.subagentStarting : '') }}</span>
      </span>
      <span :class="ui.state()">
        <icon-lucide-loader-circle v-if="working" :class="ui.spinner()" aria-hidden="true" />
        {{ state }}
      </span>
      <icon-lucide-chevron-right
        data-direction="reading"
        :class="ui.chevron()"
        aria-hidden="true"
      />
    </button>
    <ChatSubagentFollowButton
      v-if="follow.available.value"
      :name="names.name"
      :following="follow.following.value"
      @toggle="follow.toggle"
    />
  </div>
</template>
