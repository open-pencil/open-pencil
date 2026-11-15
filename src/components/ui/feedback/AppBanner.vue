<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import { banner, type BannerProps } from './banner'

const { storageKey, ui } = defineProps<BannerProps>()
const emit = defineEmits<{ action: [] }>()
const slots = defineSlots<{ default(): unknown; action?(): unknown; dismiss?(): unknown }>()

const dismissed = storageKey ? useLocalStorage(storageKey, false) : null
const styles = computed(() => {
  const theme = banner()
  return {
    root: theme.root({ class: ui?.root }),
    content: theme.content({ class: ui?.content }),
    action: theme.action({ class: ui?.action }),
    dismiss: theme.dismiss({ class: ui?.dismiss })
  }
})
</script>

<template>
  <div v-if="!dismissed" :class="styles.root" data-slot="banner" role="status">
    <span :class="styles.content"><slot /></span>
    <button
      v-if="slots.action"
      type="button"
      data-slot="banner-action"
      :class="styles.action"
      @click="emit('action')"
    >
      <slot name="action" />
    </button>
    <button
      v-if="storageKey"
      data-slot="banner-dismiss"
      :class="styles.dismiss"
      @click="dismissed = true"
    >
      <slot name="dismiss" />
    </button>
  </div>
</template>
