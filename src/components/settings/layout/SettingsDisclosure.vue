<script setup lang="ts">
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <AppCollapsible v-model:open="open" :ui="{ trigger: 'py-3' }">
    <template #label><slot name="label" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <div class="pb-3"><slot /></div>
  </AppCollapsible>
</template>
