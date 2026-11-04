<script setup lang="ts">
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <!-- The chevron glyph is inset in its box; pulling it back lines it up with the fields. -->
  <AppCollapsible v-model:open="open" :ui="{ trigger: 'py-3', icon: '-ml-1' }">
    <template #label><slot name="label" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <div class="pb-3"><slot /></div>
  </AppCollapsible>
</template>
