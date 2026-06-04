<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useClipboard } from '@vueuse/core'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'

import AppInput from '@/components/ui/AppInput.vue'
import { inviteUser, type InvitationRole } from '@/app/api/client'
import { toast } from '@/app/shell/ui'
import { useDialogUI } from '@/components/ui/dialog'

const open = defineModel<boolean>('open', { required: true })

const { boardId, boardName = 'Board' } = defineProps<{
  boardId: string | null
  boardName?: string
}>()

const email = ref('')
const role = ref<InvitationRole>('editor')
const loading = ref(false)
const invitationUrl = ref('')
const errorMessage = ref('')
const { copy, copied } = useClipboard({ copiedDuring: 1500 })
const cls = useDialogUI({
  content: 'w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-5 shadow-2xl'
})

const canSubmit = computed(() => !!boardId && email.value.trim().length > 0 && !loading.value)

watch(open, (value) => {
  if (value) return
  email.value = ''
  role.value = 'editor'
  invitationUrl.value = ''
  errorMessage.value = ''
  loading.value = false
})

async function onSubmit() {
  if (!boardId || !canSubmit.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    const invitation = await inviteUser({
      email: email.value.trim(),
      boardId,
      role: role.value
    })
    invitationUrl.value = new URL(invitation.url, window.location.origin).toString()
    toast.info('Invitation link created')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create invitation'
    errorMessage.value = message
    toast.error(message)
  } finally {
    loading.value = false
  }
}

function copyInvitationUrl() {
  if (!invitationUrl.value) return
  void copy(invitationUrl.value)
  toast.info('Link copied to clipboard')
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent data-test-id="share-modal" :class="cls.content">
        <DialogTitle :class="cls.title">共有</DialogTitle>
        <DialogDescription :class="cls.description">
          {{ boardName }} に参加するための招待 link を発行します。
        </DialogDescription>

        <div class="mt-4 space-y-4">
          <div v-if="!boardId" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            `/boards` で board を作成してから開くと、招待 link を発行できます。
          </div>

          <label class="block space-y-1.5">
            <span class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Email</span>
            <AppInput
              v-model="email"
              test-id="share-email-input"
              type="text"
              placeholder="collaborator@example.com"
              :disabled="loading || !boardId"
            />
          </label>

          <label class="block space-y-1.5">
            <span class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Role</span>
            <select
              v-model="role"
              data-test-id="share-role-select"
              class="w-full rounded border border-border bg-input px-2 py-1.5 text-xs text-surface outline-none focus:border-accent"
              :disabled="loading || !boardId"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>

          <div class="flex items-center justify-end gap-2">
            <button
              type="button"
              class="cursor-pointer rounded-md border border-border bg-canvas px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="open = false"
            >
              Close
            </button>
            <button
              type="button"
              data-test-id="share-submit"
              class="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canSubmit"
              @click="onSubmit"
            >
              {{ loading ? 'Creating…' : 'Create invite' }}
            </button>
          </div>

          <div v-if="errorMessage" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100">
            {{ errorMessage }}
          </div>

          <div
            v-if="invitationUrl"
            class="space-y-2 rounded-xl border border-border bg-canvas/80 p-3"
          >
            <div class="flex items-center justify-between gap-3">
              <span class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Invitation URL</span>
              <button
                type="button"
                data-test-id="share-copy-link"
                class="cursor-pointer rounded-md px-2 py-1 text-[11px] text-accent transition-colors hover:bg-hover"
                @click="copyInvitationUrl"
              >
                {{ copied ? 'Copied' : 'Copy' }}
              </button>
            </div>
            <p data-test-id="share-link-output" class="break-all text-xs text-surface">
              {{ invitationUrl }}
            </p>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
