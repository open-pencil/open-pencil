<script setup lang="ts">
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

/** Says a page could not read what it shows, with a way to read it again. */
const { error } = defineProps<{ error: string }>()
const emit = defineEmits<{ retry: [] }>()
const messages = useCloudPortalMessages()
</script>

<template>
  <AppAlert tone="error" :heading="messages.errorTitle" :description="error">
    <template #actions>
      <AppButton size="sm" variant="outline" @click="emit('retry')">
        {{ messages.tryAgain }}
      </AppButton>
    </template>
  </AppAlert>
</template>
