<script setup lang="ts">
import { openExternalLink } from '@/app/shell/ui'
import AppButton from '@/components/ui/AppButton.vue'

const { href } = defineProps<{ href: string }>()
</script>

<template>
  <AppButton
    color="primary"
    variant="link"
    size="xs"
    class="self-start text-left"
    @click="openExternalLink(href)"
  >
    <slot />
  </AppButton>
</template>
