<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue'

import { CAN_CHOOSE_SPEAKERS } from '@/app/collab/voice/call'

/** One person's voice, played through the chosen speakers. */
const { track, sinkId } = defineProps<{ track: MediaStreamTrack; sinkId: string }>()
const emit = defineEmits<{ sinkFailed: [] }>()

const audio = useTemplateRef<HTMLAudioElement>('audio')
const stream = computed(() => new MediaStream([track]))

watchEffect(() => {
  const element = audio.value
  if (!CAN_CHOOSE_SPEAKERS || !element) return
  // A device that is gone or refused keeps the old output, so the choice must not claim it.
  element.setSinkId(sinkId).catch(() => {
    if (sinkId) emit('sinkFailed')
  })
})
</script>

<template>
  <audio ref="audio" autoplay :srcObject.prop="stream" />
</template>
