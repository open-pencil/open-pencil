<script setup lang="ts">
import { ref } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import type { Compaction } from '@/app/ai/chat/compaction/marker'
import { formatCompactNumber } from '@/app/i18n/number'
import ChatMarkdown from '@/components/chat/ChatMarkdown.vue'

import { chatContextTheme } from '../ui'

/**
 * Where a conversation was compacted: a rule across the transcript. The messages above it stay;
 * the model reads the summary in their place, which its label opens.
 */
const { compaction, tokensAfter = null } = defineProps<{
  compaction: Compaction
  /** What the first reply after the compaction reported its request held, once there is one. */
  tokensAfter?: number | null
}>()
const { ai } = useI18n()
const ui = chatContextTheme()
const open = ref(false)
</script>

<template>
  <section
    :class="ui.divider()"
    data-test-id="chat-compaction"
    :aria-label="ai.conversationCompacted"
  >
    <div :class="ui.dividerRule()">
      <span :class="ui.dividerLine()" aria-hidden="true" />
      <button type="button" :class="ui.dividerToggle()" :aria-expanded="open" @click="open = !open">
        <icon-lucide-shrink :class="ui.dividerIcon()" aria-hidden="true" />
        <span :class="ui.dividerTitle()">{{ ai.conversationCompacted }}</span>
        <icon-lucide-chevron-down
          :class="ui.dividerChevron()"
          :data-open="open"
          aria-hidden="true"
        />
      </button>
      <span :class="ui.dividerLine()" aria-hidden="true" />
    </div>
    <div v-if="open" :class="ui.summary()">
      <p :class="ui.dividerNote()">{{ ai.compactionKeepsMessages }}</p>
      <p v-if="compaction.tokensBefore !== null && tokensAfter !== null" :class="ui.dividerNote()">
        {{
          ai.compactionTokens({
            before: formatCompactNumber(compaction.tokensBefore),
            after: formatCompactNumber(tokensAfter)
          })
        }}
      </p>
      <ChatMarkdown :content="compaction.summary" mode="static" />
    </div>
  </section>
</template>
