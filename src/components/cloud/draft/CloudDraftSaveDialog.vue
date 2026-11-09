<script setup lang="ts">
import { useCloudMessages, useCommonMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'

/**
 * Save for someone without an account on a Cloud server's own editor: sign up, or sign in, and
 * the file goes to the server, or save it to this computer as anywhere else.
 */
const { host } = defineProps<{ host: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ signUp: []; signIn: []; saveOnDevice: [] }>()

const t = useCloudMessages()
const common = useCommonMessages()
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader
      :heading="t.draftHeading"
      :description="t.draftDescription({ host })"
      :close-label="common.close"
    />
    <AppDialogFooter>
      <template #start>
        <AppButton @click="emit('saveOnDevice')">{{ t.draftSaveOnDevice }}</AppButton>
      </template>
      <AppButton variant="ghost" @click="emit('signIn')">{{ t.draftSignIn }}</AppButton>
      <AppButton color="primary" variant="solid" autofocus @click="emit('signUp')">
        {{ t.draftSignUp }}
      </AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
