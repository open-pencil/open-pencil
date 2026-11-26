<script setup lang="ts">
import { useElementVisibility } from '@vueuse/core'
import { onScopeDispose, useTemplateRef, watch } from 'vue'

const { url, width, height } = defineProps<{ url?: string; width: number; height: number }>()
const emit = defineEmits<{ visible: [visible: boolean] }>()

const frame = useTemplateRef<HTMLElement>('frame')
const visible = useElementVisibility(frame)
watch(visible, (value) => emit('visible', value), { immediate: true })
onScopeDispose(() => emit('visible', false))
</script>

<template>
  <div ref="frame" :style="{ aspectRatio: `${width} / ${height}` }">
    <img v-if="url" :src="url" alt="" draggable="false" class="block size-full" />
    <slot />
  </div>
</template>
