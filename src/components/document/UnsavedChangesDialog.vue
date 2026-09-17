<script setup lang="ts">
import { useStore } from '@nanostores/vue'
import { useFocus } from '@vueuse/core'
import { useTemplateRef } from 'vue'

import { commonMessages, filesMessages } from '@open-pencil/vue'

import { answerClosePrompt, closePrompt } from '@/app/document/close/prompt'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlertDialogRoot from '@/components/ui/dialog/AppAlertDialogRoot.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import { documentCloseUI, documentCloseButtonUI } from '@/theme/document/close'

const files = useStore(filesMessages)
const common = useStore(commonMessages)
const saveButton = useTemplateRef('saveButton')

// The dialog mounts on open, so focusing the primary action when the target appears keeps
// Return on Save while Escape still cancels.
useFocus(saveButton, { initialValue: true, preventScroll: true })

function updateOpen(open: boolean) {
  if (!open) answerClosePrompt('cancel')
}
</script>

<template>
  <AppAlertDialogRoot :open="closePrompt !== null" @update:open="updateOpen">
    <AppDialogHeader
      :heading="files.saveBeforeClosing({ name: closePrompt?.documentName ?? '' })"
      :description="files.saveBeforeClosingDescription"
      :show-close="false"
      :ui="documentCloseUI"
    />
    <AppDialogFooter :ui="documentCloseUI">
      <AppButton
        color="neutral"
        variant="ghost"
        class="mr-auto"
        @click="answerClosePrompt('discard')"
      >
        {{ files.discard }}
      </AppButton>
      <AppButton
        color="neutral"
        variant="outline"
        :ui="documentCloseButtonUI"
        @click="answerClosePrompt('cancel')"
      >
        {{ common.cancel }}
      </AppButton>
      <AppButton
        ref="saveButton"
        color="primary"
        variant="solid"
        :ui="documentCloseButtonUI"
        @click="answerClosePrompt('save')"
      >
        {{ common.save }}
      </AppButton>
    </AppDialogFooter>
  </AppAlertDialogRoot>
</template>
