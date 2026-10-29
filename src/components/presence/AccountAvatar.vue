<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import PersonAvatar from '@/components/presence/PersonAvatar.vue'
import { PEER_COLORS } from '@/constants'

import { avatar } from './ui'

/**
 * An account's picture, such as one its sign-in provider gave it, or else its initials on a color
 * that stays the same for that account. A picture that fails to load falls back to the initials.
 */
const {
  id,
  name,
  image = null,
  size = 'sm'
} = defineProps<{ id: string; name: string; image?: string | null; size?: 'sm' | 'md' | 'lg' }>()

const color = computed(() => {
  let hash = 0
  for (const character of id) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0
  return PEER_COLORS[hash % PEER_COLORS.length] ?? PEER_COLORS[0]
})
const failed = ref(false)
watch(
  () => image,
  () => {
    failed.value = false
  }
)
</script>

<template>
  <img
    v-if="image && !failed"
    :src="image"
    alt=""
    referrerpolicy="no-referrer"
    :class="avatar({ size, bordered: true, class: 'object-cover' })"
    @error="failed = true"
  />
  <PersonAvatar v-else :name="name" :color="color" :size="size" />
</template>
