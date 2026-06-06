<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClipboard } from '@vueuse/core'
import { useHead } from '@unhead/vue'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle
} from 'reka-ui'

import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import ShareModal from '@/components/ShareModal.vue'
import {
  createBoardEditorLocation,
  listInvitations,
  revokeInvitation,
  type BoardInvitationsResponse
} from '@/app/api/client'
import { toast } from '@/app/shell/ui'
import { useDialogUI } from '@/components/ui/dialog'

const route = useRoute()
const router = useRouter()
const { copy, copied } = useClipboard({ copiedDuring: 1500 })

const boardId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const payload = ref<BoardInvitationsResponse | null>(null)
const loading = ref(false)
const shareOpen = ref(false)
const errorMessage = ref('')
const revokeOpen = ref(false)
const revokeTarget = ref<BoardInvitationsResponse['invitations'][number] | null>(null)
const cls = useDialogUI({
  content: 'w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-5 shadow-2xl'
})

useHead({
  title: computed(() => (payload.value ? `${payload.value.board.name} Settings` : 'Board Settings'))
})

async function loadBoardSettings() {
  if (!boardId.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    payload.value = await listInvitations(boardId.value)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load board settings'
    errorMessage.value = message
    toast.error(message)
  } finally {
    loading.value = false
  }
}

async function revoke(invitationId: string) {
  if (!payload.value) return
  try {
    await revokeInvitation(payload.value.board.id, invitationId)
    await loadBoardSettings()
    toast.info('Invitation revoked')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke invitation'
    toast.error(message)
  }
}

function requestRevoke(invitation: BoardInvitationsResponse['invitations'][number]) {
  revokeTarget.value = invitation
  revokeOpen.value = true
}

async function confirmRevoke() {
  const invitation = revokeTarget.value
  revokeOpen.value = false
  revokeTarget.value = null
  if (!invitation) return
  await revoke(invitation.id)
}

function invitationUrl(token: string | null) {
  return token ? `${window.location.origin}/invite/${token}` : 'Link unavailable'
}

function copyInvitationUrl(token: string | null) {
  if (!token) return
  void copy(invitationUrl(token))
  toast.info('Link copied to clipboard')
}

function onInvitationCreated() {
  void loadBoardSettings()
}

function openBoard() {
  if (!payload.value) return
  void router.push(createBoardEditorLocation(payload.value.board))
}

onMounted(() => {
  void loadBoardSettings()
})
</script>

<template>
  <main
    data-test-id="board-settings-view"
    class="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(255,190,92,0.14),transparent_28%),linear-gradient(180deg,var(--color-canvas),#0c1119)] px-6 py-10"
  >
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section class="rounded-[28px] border border-white/8 bg-panel/85 p-6 shadow-2xl backdrop-blur-xl">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div class="space-y-2">
            <button
              type="button"
              class="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="router.push('/boards')"
            >
              Back to boards
            </button>
            <h1 class="text-3xl font-semibold text-surface">
              {{ payload?.board.name ?? 'Board settings' }}
            </h1>
            <p class="text-sm text-muted">
              Review invitation links and the anonymous collaborators that have accepted them.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <LocaleSwitcher test-id="board-settings-locale-switcher" />
            <button
              type="button"
              class="cursor-pointer rounded-xl border border-border bg-canvas px-3 py-2 text-xs text-surface transition-colors hover:bg-hover"
              @click="openBoard"
            >
              Open board
            </button>
            <button
              type="button"
              data-test-id="board-settings-share-button"
              class="cursor-pointer rounded-xl bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent/90"
              @click="shareOpen = true"
            >
              New invite
            </button>
          </div>
        </div>
      </section>

      <section v-if="loading" class="rounded-2xl border border-border bg-panel/70 p-6 text-sm text-muted">
        Loading board settings…
      </section>

      <section
        v-else-if="errorMessage"
        class="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-100"
      >
        {{ errorMessage }}
      </section>

      <template v-else-if="payload">
        <section class="rounded-[24px] border border-border bg-panel/75 p-5">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-surface">Invitation links</h2>
            <button
              type="button"
              class="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="loadBoardSettings"
            >
              Refresh
            </button>
          </div>

          <ul data-test-id="board-invitation-list" class="mt-4 space-y-3">
            <li
              v-for="invitation in payload.invitations"
              :key="invitation.id"
              class="rounded-2xl border border-border bg-canvas/70 p-4"
            >
              <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div class="space-y-1">
                  <p class="text-sm font-medium text-surface">
                    {{ invitation.role === 'editor' ? 'Editor invite' : 'Viewer invite' }}
                  </p>
                  <p class="break-all text-xs text-muted">
                    {{ invitationUrl(invitation.token) }}
                  </p>
                  <p class="text-[11px] text-muted">
                    {{ invitation.revoked ? 'Revoked' : 'Active' }} · Expires
                    {{ new Date(invitation.expiresAt).toLocaleString() }}
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    data-test-id="board-copy-invitation"
                    class="cursor-pointer rounded-md border border-border bg-panel px-2 py-1 text-[11px] text-surface transition-colors hover:bg-hover"
                    :disabled="!invitation.token"
                    @click="copyInvitationUrl(invitation.token)"
                  >
                    {{ copied ? 'Copied' : 'Copy' }}
                  </button>
                  <button
                    type="button"
                    data-test-id="board-revoke-invitation"
                    class="cursor-pointer rounded-md px-2 py-1 text-[11px] text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
                    :disabled="invitation.revoked"
                    @click="requestRevoke(invitation)"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </li>

            <li
              v-if="payload.invitations.length === 0"
              class="rounded-2xl border border-dashed border-border bg-canvas/50 p-5 text-sm text-muted"
            >
              No invitation links yet.
            </li>
          </ul>
        </section>

        <section class="rounded-[24px] border border-border bg-panel/75 p-5">
          <h2 class="text-lg font-semibold text-surface">Collaborators</h2>
          <ul data-test-id="board-collaborator-list" class="mt-4 space-y-3">
            <li
              v-for="collaborator in payload.board.collaborators"
              :key="collaborator.anonymousId"
              class="flex items-center justify-between rounded-2xl border border-border bg-canvas/70 px-4 py-3"
            >
              <div>
                <p class="text-sm font-medium text-surface">{{ collaborator.anonymousId }}</p>
                <p class="text-[11px] text-muted">
                  Added {{ new Date(collaborator.addedAt).toLocaleString() }}
                </p>
              </div>
              <span class="rounded-full border border-white/10 bg-panel px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-muted">
                {{ collaborator.role }}
              </span>
            </li>
          </ul>
        </section>
      </template>
    </div>

    <ShareModal
      v-model:open="shareOpen"
      :board-id="payload?.board.id ?? boardId"
      :board-name="payload?.board.name ?? 'Board'"
      @created="onInvitationCreated"
    />

    <AlertDialogRoot :open="revokeOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay :class="cls.overlay" @click="revokeOpen = false" />
        <AlertDialogContent
          data-test-id="board-revoke-dialog"
          :class="cls.content"
          @escape-key-down="revokeOpen = false"
        >
          <AlertDialogTitle :class="cls.title">Revoke invitation</AlertDialogTitle>
          <AlertDialogDescription :class="cls.description">
            This invite link will stop working immediately. Existing collaborators keep their
            current access.
          </AlertDialogDescription>

          <div class="mt-4 rounded-xl border border-border bg-canvas/70 p-3 text-xs text-muted">
            {{ revokeTarget?.token ? invitationUrl(revokeTarget.token) : 'Link unavailable' }}
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <AlertDialogCancel
              data-test-id="board-revoke-cancel"
              class="rounded-md border border-border bg-canvas px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="revokeOpen = false"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-test-id="board-revoke-confirm"
              class="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500/90"
              @click="confirmRevoke"
            >
              Revoke link
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </main>
</template>
