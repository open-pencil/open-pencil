<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { ref } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { downloadBlob } from '@/app/document/io/browser'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'

/**
 * Recovery codes, shown once right after they are made. They can't be shown again, so the dialog
 * closes only once they were copied or downloaded.
 */
const { codes } = defineProps<{ codes: string[] }>()
const open = defineModel<boolean>('open', { default: false })

const messages = useCloudPortalMessages()
const { copy, copied } = useClipboard({ copiedDuring: 1500 })
const saved = ref(false)

async function copyCodes() {
  await copy(codes.join('\n'))
  saved.value = true
}

function downloadCodes() {
  downloadBlob(
    new TextEncoder().encode(`${codes.join('\n')}\n`),
    'openpencil-recovery-codes.txt',
    'text/plain'
  )
  saved.value = true
}
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
      <p v-if="!saved" class="mt-2 text-[11px] text-muted">{{ messages.recoveryCodesSaveFirst }}</p>
    </AppDialogBody>
    <AppDialogFooter :ui="{ footer: 'justify-between' }">
      <div class="flex items-center gap-1">
        <AppButton variant="outline" @click="copyCodes">
          <template #leading>
            <icon-lucide-check v-if="copied" class="size-3.5" />
            <icon-lucide-copy v-else class="size-3.5" />
          </template>
          {{ copied ? messages.copied : messages.copyCodes }}
        </AppButton>
        <AppButton variant="ghost" @click="downloadCodes">
          <template #leading><icon-lucide-download class="size-3.5" /></template>
          {{ messages.downloadCodes }}
        </AppButton>
      </div>
      <AppButton color="primary" variant="solid" :disabled="!saved" @click="open = false">
        {{ messages.done }}
      </AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
