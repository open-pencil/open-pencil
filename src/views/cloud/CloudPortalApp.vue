<script setup lang="ts">
import { RouterView } from 'vue-router'

import { usePortalTheme } from '@/app/cloud-portal/theme'
import PortalToaster from '@/components/cloud-portal/layout/PortalToaster.vue'

usePortalTheme()
</script>

<template>
  <RouterView />
  <PortalToaster />
</template>
