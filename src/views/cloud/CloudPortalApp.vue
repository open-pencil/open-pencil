<script setup lang="ts">
import { RouterView } from 'vue-router'

import { usePortalTheme } from '@/app/cloud-portal/theme'

usePortalTheme()
</script>

<template>
  <RouterView />
</template>
