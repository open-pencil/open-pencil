<script setup lang="ts">
import { computed } from 'vue'

import PersonAvatar from '@/components/presence/PersonAvatar.vue'
import { PEER_COLORS } from '@/constants'

/** An account's initials on a color that stays the same for that account. */
const { id, name, size = 'sm' } = defineProps<{ id: string; name: string; size?: 'sm' | 'md' }>()

const color = computed(() => {
  let hash = 0
  for (const character of id) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0
  return PEER_COLORS[hash % PEER_COLORS.length] ?? PEER_COLORS[0]
})
</script>

<template>
  <PersonAvatar :name="name" :color="color" :size="size" />
</template>
