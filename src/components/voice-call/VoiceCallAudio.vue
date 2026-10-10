<script setup lang="ts">
import { computed } from 'vue'

import { useVoiceCall } from '@/app/collab/voice/call'

import VoiceCallTrack from './VoiceCallTrack.vue'

/** Plays the call's voices; mounted once for the window, so a call outlives the view. */
const call = useVoiceCall()
const voices = computed(() => [...(call.room.value?.voice.audio.value ?? [])])
</script>

<template>
  <VoiceCallTrack
    v-for="[clientId, track] in voices"
    :key="clientId"
    :track="track"
    :sink-id="call.sinkId.value"
  />
</template>
