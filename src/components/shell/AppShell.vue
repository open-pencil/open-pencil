<script setup lang="ts">
import { useExternalLinks } from '@/app/shell/external-links'
import { useShellMenu } from '@/app/shell/menu/use'

useShellMenu()
useExternalLinks()
</script>

<template>
  <slot />
</template>
