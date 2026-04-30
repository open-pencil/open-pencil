<script setup lang="ts">
import { onMounted } from 'vue'
import { useHead } from '@unhead/vue'
import { TooltipProvider } from 'reka-ui'

import { provideEditor } from '@open-pencil/vue'
import AppToast from '@/components/AppToast.vue'
import { useEditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'
import { useAppTheme } from '@/app/shell/theme'

useHead({ titleTemplate: (title) => (title ? `${title} — OpenPencil` : 'OpenPencil') })

const store = useEditorStore()
provideEditor(store)
useAppTheme()

onMounted(() => {
  toast.setupGlobalErrorHandler()
})
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <RouterView />
    <AppToast />
  </TooltipProvider>
</template>
