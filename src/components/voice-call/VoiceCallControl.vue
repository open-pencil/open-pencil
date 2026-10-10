<script setup lang="ts">
import type { PresencePersonRow } from '@/components/presence/rows'

import { useVoiceCallControl } from './useVoiceCallControl'
import VoiceCallMenu from './VoiceCallMenu.vue'

/** The active tab's room call, wired to this window's microphone. */
const { people } = defineProps<{ people: PresencePersonRow[] }>()

const control = useVoiceCallControl(() => people)
const { microphone, speaker } = control
</script>

<template>
  <VoiceCallMenu
    v-model:microphone="microphone"
    v-model:speaker="speaker"
    :people="people"
    :in-call="control.inCall.value"
    :others-in-call="control.othersInCall.value"
    :muted="control.muted.value"
    :joining="control.joining.value"
    :error="control.error.value"
    :microphones="control.microphones.value"
    :speakers="control.speakers.value"
    @join="control.join"
    @toggle-mute="control.toggleMuted"
    @leave="control.leave"
    @close="control.dismissError"
  />
</template>
