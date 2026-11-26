<script setup lang="ts">
import { computed } from 'vue'

import { useKeyPlatform } from './keys'

/** A shortcut on the reader's keyboard, its keys separated by spaces. */
const { mac, other } = defineProps<{ mac: string; other: string }>()

const platform = useKeyPlatform()
const keys = computed(() => (platform.value === 'mac' ? mac : other).split(' '))
</script>

<template>
  <span class="keys"
    ><kbd v-for="key in keys" :key="key">{{ key }}</kbd></span
  >
</template>

<style scoped>
.keys {
  white-space: nowrap;
}
</style>
