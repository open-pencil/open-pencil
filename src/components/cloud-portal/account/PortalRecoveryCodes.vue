<script setup lang="ts">
import { useClipboard } from '@vueuse/core'

import { useCloudPortalMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'

/** Recovery codes, shown once right after they are made. */
const { codes } = defineProps<{ codes: string[] }>()
const open = defineModel<boolean>('open', { default: false })

const messages = useCloudPortalMessages()
const { copy, copied } = useClipboard({ copiedDuring: 1500 })
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader
      :heading="messages.recoveryCodesTitle"
      :description="messages.recoveryCodesDescription"
      :show-close="false"
    />
    <AppDialogBody>
      <ul
        class="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-input px-4 py-3 font-mono text-xs"
      >
        <li v-for="code in codes" :key="code" class="select-all">{{ code }}</li>
      </ul>
    </AppDialogBody>
    <AppDialogFooter>
      <AppButton variant="outline" @click="copy(codes.join('\n'))">
        {{ copied ? messages.copied : messages.copyCodes }}
      </AppButton>
      <AppButton color="primary" variant="solid" @click="open = false">{{
        messages.done
      }}</AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
