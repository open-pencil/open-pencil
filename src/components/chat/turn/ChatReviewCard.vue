<script setup lang="ts">
import { useMessages } from '@open-pencil/vue/i18n'

import type { DesignReview } from '@/app/ai/review/message'
import ChatMarkdown from '@/components/chat/ChatMarkdown.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

import { chatReviewTheme } from '../ui'

/**
 * A design review the Review model wrote. No model reads it; Fix these sends its findings to the
 * Design model as the person's message.
 */
const { review, canFix = false } = defineProps<{
  review: DesignReview
  /** Whether the chat is ready to take a message. */
  canFix?: boolean
}>()
const emit = defineEmits<{ fix: [] }>()
const ai = useMessages('ai')
const ui = chatReviewTheme()
</script>

<template>
  <section
    :class="ui.root()"
    data-test-id="chat-review"
    :aria-label="review.change ? ai.changeReview : ai.designReview"
  >
    <header :class="ui.header()">
      <icon-lucide-scan-eye :class="ui.icon()" aria-hidden="true" />
      {{ review.change ? ai.changeReview : ai.designReview }}
    </header>
    <p v-if="review.focus" :class="ui.focus()">{{ review.focus }}</p>
    <div :class="ui.findings()">
      <ChatMarkdown :content="review.findings" />
    </div>
    <div :class="ui.actions()">
      <AppButton size="xs" variant="ghost" :disabled="!canFix" @click="emit('fix')">
        <icon-lucide-wand-sparkles class="size-3" aria-hidden="true" />
        {{ ai.reviewFix }}
      </AppButton>
    </div>
  </section>
</template>
