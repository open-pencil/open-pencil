<script setup lang="ts">
import { computed } from 'vue'

import { colorToCSS } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { useCollaborationMessages } from '@open-pencil/vue'

import { initials } from '@/app/shell/ui'
import { avatar } from '@/theme/collaboration/avatar'
import { avatarStack } from '@/theme/collaboration/avatar-stack'

import type { PresenceVoice } from './rows'

/** A person's initials on their color, with how many agents they run and how they are in the call. */
const {
  name,
  color,
  agentCount = 0,
  size = 'sm',
  following = false,
  interactive = false,
  voice
} = defineProps<{
  name: string
  color: Color
  agentCount?: number
  size?: 'sm' | 'md'
  following?: boolean
  interactive?: boolean
  voice?: PresenceVoice
}>()

const messages = useCollaborationMessages()
const ui = avatarStack()
const voiceState = computed(() => {
  if (!voice) return 'none'
  return voice.speaking ? 'speaking' : 'listening'
})
</script>

<template>
  <span :class="ui.person()" :data-voice="voiceState === 'none' ? undefined : voiceState">
    <span
      :class="avatar({ size, bordered: true, following, interactive, voice: voiceState })"
      :style="{ background: colorToCSS(color) }"
    >
      {{ initials(name) }}
    </span>
    <span
      v-if="voice?.muted"
      role="img"
      :aria-label="messages.muted"
      :class="ui.muted()"
      data-test-id="presence-muted"
    >
      <icon-lucide-mic-off :class="ui.mutedIcon()" aria-hidden="true" />
    </span>
    <span v-if="agentCount > 0" :class="ui.badge()" :style="{ color: colorToCSS(color) }">
      <icon-lucide-sparkle :class="ui.badgeIcon()" />{{ agentCount }}
    </span>
  </span>
</template>
