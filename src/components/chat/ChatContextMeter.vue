<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { compactAutomatically } from '@/app/ai/chat/preferences'
import { formatCompactNumber } from '@/app/i18n/number'
import ChatCreditBalance from '@/components/chat/ChatCreditBalance.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'

import { chatContextTheme } from './ui'

/**
 * How full the conversation's context is, as a meter in the chat's header. Its popover tells the
 * tokens, when the conversation compacts, and what Cloud credits are left; compaction itself is
 * a setting and `/compact`.
 */
const {
  used,
  contextWindow,
  compactsAt,
  replying = false
} = defineProps<{
  used: number
  contextWindow: number
  compactsAt: number
  replying?: boolean
}>()
const { ai } = useI18n()
const ui = chatContextTheme()
const popover = usePopoverUI({ content: ui.popover() })

/** The share past which the meter warns, as the bar over the message field does. */
const FULL = 0.7

const ratio = computed(() => Math.min(1, used / contextWindow))
const percent = computed(() => Math.round(ratio.value * 100))
const full = computed(() => ratio.value >= FULL)
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger
      :class="ui.meter()"
      :aria-label="ai.contextUsed({ percent: percent })"
      data-test-id="chat-context-meter"
    >
      <span :class="ui.miniBar()" aria-hidden="true">
        <span :class="ui.barValue()" :data-full="full" :style="{ width: `${percent}%` }" />
      </span>
      {{ percent }}%
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        align="end"
        :side-offset="4"
        :collision-padding="8"
        :class="popover.content"
        data-test-id="chat-context-popover"
      >
        <div :class="ui.popoverHeader()">
          <span :class="ui.popoverTitle()">{{ ai.contextTitle }}</span>
          <span :class="ui.popoverValue()">
            {{
              ai.contextTokens({
                used: formatCompactNumber(used),
                total: formatCompactNumber(contextWindow)
              })
            }}
          </span>
        </div>
        <div :class="ui.bar()">
          <div :class="ui.barValue()" :data-full="full" :style="{ width: `${percent}%` }" />
        </div>
        <p :class="ui.note()">
          {{
            compactAutomatically
              ? ai.contextCompactsAt({ tokens: formatCompactNumber(compactsAt) })
              : ai.contextCompactsOff
          }}
        </p>
        <div :class="ui.credits()">
          <ChatCreditBalance :replying="replying" />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
