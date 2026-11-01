<script setup lang="ts">
import { ref } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import type { Compaction } from '@/app/ai/chat/compaction/marker'
import { formatCompactNumber } from '@/app/i18n/number'
import ChatMarkdown from '@/components/chat/ChatMarkdown.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

import { chatContextTheme } from '../ui'

/**
 * Where a conversation was compacted. The messages above it stay in the transcript; the model
 * reads the summary in their place, which opens here.
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
    <div :class="ui.dividerHeader()">
      <icon-lucide-shrink :class="ui.dividerIcon()" aria-hidden="true" />
      <span :class="ui.dividerTitle()">{{ ai.conversationCompacted }}</span>
      <span
        v-if="compaction.tokensBefore !== null && tokensAfter !== null"
        :class="ui.dividerTokens()"
      >
        {{
          ai.compactionTokens({
            before: formatCompactNumber(compaction.tokensBefore),
            after: formatCompactNumber(tokensAfter)
          })
        }}
      </span>
    </div>
    <p :class="ui.dividerNote()">{{ ai.compactionKeepsMessages }}</p>
    <div v-if="open" :class="ui.summary()">
      <ChatMarkdown :content="compaction.summary" mode="static" />
    </div>
    <AppButton
      size="xs"
      variant="ghost"
      class="self-start"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ open ? ai.hideSummary : ai.showSummary }}
    </AppButton>
  </section>
</template>
