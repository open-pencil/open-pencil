<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, useTemplateRef } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import type { SubagentTranscript } from '@/app/ai/chat/subagents'
import { chatSubagentTheme } from '@/components/chat/ui'
import IconButton from '@/components/ui/button/IconButton.vue'
import historyTheme from '@/theme/chat/history'

import ChatSubagentFollowButton from './ChatSubagentFollowButton.vue'
import { subagentNames, subagentStateLabel } from './state'
import { useSubagentFollow } from './useSubagentFollow'

/**
 * The chat's header while a subagent's thread is open, in place of the conversation's: the way
 * back, the subagent as its cursor shows it, its state, and following it.
 */
const { transcript } = defineProps<{ transcript: SubagentTranscript }>()
const emit = defineEmits<{ back: [] }>()

const { ai, common } = useI18n()
const styles = tv(historyTheme)()
const ui = chatSubagentTheme()
const names = computed(() => subagentNames(transcript, ai.value.subagent))
const state = computed(() => ai.value[subagentStateLabel(transcript.state)])
const working = computed(() => transcript.state === undefined || transcript.state === 'running')
const follow = useSubagentFollow(() => transcript)
const root = useTemplateRef<HTMLElement>('root')

defineExpose({
  /** Moves focus to the way back, as the thread opens. */
  focus: () => root.value?.querySelector('button')?.focus()
})
</script>

<template>
  <div ref="root" :class="styles.root()" data-test-id="chat-subagent-header">
    <div :class="styles.header()">
      <IconButton :label="`${common.back}: ${ai.subagentBack}`" size="sm" @click="emit('back')">
        <icon-lucide-chevron-left data-direction="reading" :class="styles.icon()" />
      </IconButton>
      <icon-lucide-bot
        :class="ui.icon()"
        :style="transcript.agent ? { color: transcript.agent.color } : undefined"
        aria-hidden="true"
      />
      <span :class="styles.heading()">
        <span :class="ui.names()">
          <span :class="ui.title()">{{ names.name }}</span>
          <span v-if="names.title" :class="ui.subtitle()">{{ names.title }}</span>
        </span>
      </span>
      <span :class="ui.state()">
        <icon-lucide-loader-circle v-if="working" :class="ui.spinner()" aria-hidden="true" />
        {{ state }}
      </span>
      <ChatSubagentFollowButton
        v-if="follow.available.value"
        :name="names.name"
        :following="follow.following.value"
        @toggle="follow.toggle"
      />
    </div>
  </div>
</template>
