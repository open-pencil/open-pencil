<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'

import { useI18n } from '@open-pencil/vue/i18n'

import type { Compaction } from '@/app/ai/chat/compaction/marker'
import { formatCompactNumber } from '@/app/i18n/number'
import ChatMarkdown from '@/components/chat/ChatMarkdown.vue'

import { chatContextTheme } from '../ui'

/**
 * Where a conversation was compacted: a rule across the transcript. The messages above it stay;
 * the model reads the summary in their place, which its label opens. An agent that compacted
 * its own context may have reported no summary to open.
 */
const { compaction, tokensAfter = null } = defineProps<{
  compaction: Compaction
  /** What the first reply after the compaction reported its request held, once there is one. */
  tokensAfter?: number | null
}>()
const { ai } = useI18n()
const ui = chatContextTheme()
</script>

<template>
  <!-- A collapsible with its own header shape, so it drives Reka directly and keeps the shared
       content motion, as the reasoning row does. -->
  <CollapsibleRoot
    as="section"
    :class="ui.divider()"
    data-test-id="chat-compaction"
    :aria-label="ai.conversationCompacted"
  >
    <div :class="ui.dividerRule()">
      <span :class="ui.dividerLine()" aria-hidden="true" />
      <CollapsibleTrigger :class="ui.dividerToggle()">
        <icon-lucide-shrink :class="ui.dividerIcon()" aria-hidden="true" />
        <span :class="ui.dividerTitle()">{{ ai.conversationCompacted }}</span>
        <icon-lucide-chevron-down :class="ui.dividerChevron()" aria-hidden="true" />
      </CollapsibleTrigger>
      <span :class="ui.dividerLine()" aria-hidden="true" />
    </div>
    <CollapsibleContent :class="ui.dividerContent()">
      <div :class="ui.summary()">
        <p :class="ui.dividerNote()">
          {{ compaction.agent ? ai.agentCompactionKeepsMessages : ai.compactionKeepsMessages }}
        </p>
        <p
          v-if="compaction.tokensBefore !== null && tokensAfter !== null"
          :class="ui.dividerNote()"
        >
          {{
            ai.compactionTokens({
              before: formatCompactNumber(compaction.tokensBefore),
              after: formatCompactNumber(tokensAfter)
            })
          }}
        </p>
        <ChatMarkdown v-if="compaction.summary" :content="compaction.summary" mode="static" />
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
