<script setup lang="ts">
import { openExternalLink } from '@/app/shell/ui'
import AppTextButton from '@/components/ui/AppTextButton.vue'

const { href } = defineProps<{ href: string }>()
</script>

<template>
  <AppTextButton
    size="sm"
    underline
    :ui="{ base: 'self-start text-left text-[11px]' }"
    @click="openExternalLink(href)"
  >
    <slot />
  </AppTextButton>
</template>
