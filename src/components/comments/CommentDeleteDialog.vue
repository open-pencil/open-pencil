<script setup lang="ts">
import { ref } from 'vue'

import { useCommentMessages, useCommonMessages } from '@open-pencil/vue'

import { useComments } from '@/app/comments/use'
import { useActionToast } from '@/app/shell/toast/action'
import { AppConfirmationDialog } from '@/components/ui/dialog'

/** Asks before a comment is deleted for everyone, wherever the deletion was asked for. */
const comments = useComments()
const messages = useCommentMessages()
const common = useCommonMessages()
const { showActionToast } = useActionToast()

// The dialog closes itself before it confirms, so it keeps which comment it was asked about.
const open = ref(false)
const target = ref<string | null>(null)

comments.onDeleteRequested((id) => {
  target.value = id
  open.value = true
})

function confirm() {
  if (!target.value) return
  comments.confirmDelete(target.value)
  target.value = null
  showActionToast(messages.value.commentDeleted)
}
</script>

<template>
  <AppConfirmationDialog
    v-model:open="open"
    :heading="messages.deleteComment"
    :description="messages.deleteCommentDescription"
    :cancel-label="common.cancel"
    :confirm-label="messages.delete"
    tone="danger"
    @confirm="confirm"
  />
</template>
