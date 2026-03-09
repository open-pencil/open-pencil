<script setup lang="ts">
import { onMounted } from 'vue'
import { useHead } from '@unhead/vue'

import AppToast from '@/components/AppToast.vue'
import { toast } from '@/composables/use-toast'

useHead({ titleTemplate: (title) => (title ? `${title} — OpenPencil` : 'OpenPencil') })

onMounted(() => {
  toast.setupGlobalErrorHandler()
})
</script>

<template>
  <RouterView />
  <AppToast />
</template>
