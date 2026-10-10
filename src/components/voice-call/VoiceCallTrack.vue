<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue'

import { CAN_CHOOSE_SPEAKERS } from '@/app/collab/voice/call'

/** One person's voice, played through the chosen speakers. */
const { track, sinkId } = defineProps<{ track: MediaStreamTrack; sinkId: string }>()

const audio = useTemplateRef<HTMLAudioElement>('audio')
const stream = computed(() => new MediaStream([track]))

watchEffect(() => {
  const element = audio.value
  if (!CAN_CHOOSE_SPEAKERS || !element) return
  // A device unplugged since it was chosen keeps playing through the current one.
  element.setSinkId(sinkId).catch(() => undefined)
})
</script>

<template>
  <audio ref="audio" autoplay :srcObject.prop="stream" />
</template>
