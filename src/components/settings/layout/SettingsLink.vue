<script setup lang="ts">
import ExternalLink from '@/components/links/ExternalLink.vue'

const { href } = defineProps<{ href: string }>()
</script>

<template>
  <ExternalLink :href="href" class="text-[11px]"><slot /></ExternalLink>
</template>
