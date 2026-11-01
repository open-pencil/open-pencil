<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { compactAutomatically } from '@/app/ai/chat/preferences'
import { formatCompactNumber } from '@/app/i18n/number'
import ChatCreditBalance from '@/components/chat/ChatCreditBalance.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'

import { chatContextTheme } from './ui'

/**
 * How full the conversation's context is, as a ring in the chat's header. Its popover tells the
 * tokens, compacts now or with instructions, turns automatic compaction on or off, and shows
 * what Cloud credits are left.
 */
const {
  used,
  contextWindow,
  compactsAt,
  canCompact = true,
  compacting = false,
  replying = false
} = defineProps<{
  used: number
  contextWindow: number
  compactsAt: number
  canCompact?: boolean
  compacting?: boolean
  replying?: boolean
}>()
const emit = defineEmits<{ compact: []; compactWithInstructions: [] }>()
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
        <div v-if="canCompact" :class="ui.actions()">
          <AppButton
            size="xs"
            color="primary"
            variant="solid"
            class="flex-1"
            :disabled="compacting || replying"
            data-test-id="chat-compact-now"
            @click="emit('compact')"
          >
            {{ compacting ? ai.compacting : ai.compactNow }}
          </AppButton>
          <AppButton
            size="xs"
            variant="outline"
            class="flex-1"
            :disabled="compacting || replying"
            @click="emit('compactWithInstructions')"
          >
            {{ ai.compactWithInstructions }}
          </AppButton>
        </div>
        <div :class="ui.toggle()">
          <AppCheckbox v-model="compactAutomatically" :ariaLabel="ai.compactAutomatically" />
          <span aria-hidden="true">{{ ai.compactAutomatically }}</span>
        </div>
        <div :class="ui.credits()">
          <ChatCreditBalance :replying="replying" />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
