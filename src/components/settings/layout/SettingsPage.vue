<script setup lang="ts">
import { AppDialogBody, AppDialogFooter } from '@/components/ui/dialog'
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" data-slot="settings-page">
    <AppDialogBody :ui="{ body: 'p-5 sm:p-6' }">
      <slot />
    </AppDialogBody>
    <AppDialogFooter v-if="$slots.footer">
      <template v-if="$slots['footer-start']" #start><slot name="footer-start" /></template>
      <slot name="footer" />
    </AppDialogFooter>
  </div>
</template>
