<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'

import { createBoardEditorLocation } from '@/app/api/client'
import { addTeamMember, getTeam, type TeamDetailResponse } from '@/app/api/teams'
import { toast } from '@/app/shell/ui'
import AppInput from '@/components/ui/AppInput.vue'
import { useDialogUI } from '@/components/ui/dialog'

const route = useRoute()
const router = useRouter()
const payload = ref<TeamDetailResponse | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const inviteOpen = ref(false)
const inviteEmail = ref('')
const inviteRole = ref<'editor' | 'viewer'>('editor')
const inviting = ref(false)
const cls = useDialogUI({
  content: 'w-[min(30rem,calc(100vw-2rem))] rounded-2xl p-5 shadow-2xl'
})

const teamId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const isOwner = computed(() => payload.value?.team.role === 'owner')

useHead({
  title: computed(() => (payload.value ? `${payload.value.team.name} Team` : 'Team'))
})

async function loadTeam() {
  if (!teamId.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    payload.value = await getTeam(teamId.value)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load team'
    errorMessage.value = message
    toast.error(message)
  } finally {
    loading.value = false
  }
}

async function inviteMember() {
  if (!teamId.value) return
  inviting.value = true

  try {
    await addTeamMember(teamId.value, {
      email: inviteEmail.value.trim(),
      role: inviteRole.value
    })
    inviteOpen.value = false
    inviteEmail.value = ''
    inviteRole.value = 'editor'
    await loadTeam()
    toast.info('Member added')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add member'
    toast.error(message)
  } finally {
    inviting.value = false
  }
}

function openBoard(board: NonNullable<TeamDetailResponse['boards']>[number]) {
  void router.push(createBoardEditorLocation(board))
}

onMounted(() => {
  void loadTeam()
})
</script>

<template>
  <main
    data-test-id="team-detail-view"
    class="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(255,174,92,0.14),transparent_28%),linear-gradient(180deg,var(--color-canvas),#0c1119)] px-6 py-10"
  >
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section class="rounded-[28px] border border-white/8 bg-panel/85 p-6 shadow-2xl backdrop-blur-xl">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div class="space-y-2">
            <button
              type="button"
              class="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="router.push('/teams')"
            >
              Back to teams
            </button>
            <h1 class="text-3xl font-semibold text-surface">
              {{ payload?.team.name ?? 'Team' }}
            </h1>
            <p class="text-sm text-muted">
              {{ payload?.team.memberCount ?? 0 }} members · {{ payload?.team.boardCount ?? 0 }} boards
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              data-test-id="team-detail-invite-button"
              class="cursor-pointer rounded-xl bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!isOwner"
              @click="inviteOpen = true"
            >
              Invite member
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-xl border border-border bg-canvas px-3 py-2 text-xs text-surface transition-colors hover:bg-hover"
              @click="router.push(`/team/${teamId}/settings`)"
            >
              Settings
            </button>
          </div>
        </div>
      </section>

      <section v-if="loading" class="rounded-2xl border border-border bg-panel/70 p-6 text-sm text-muted">
        Loading team…
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
            <h2 class="text-lg font-semibold text-surface">Members</h2>
            <span
              class="rounded-full border border-white/10 bg-canvas/60 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-muted"
            >
              {{ payload.team.role }}
            </span>
          </div>

          <ul class="mt-4 space-y-3">
            <li
              v-for="member in payload.members"
              :key="member.userId"
              class="flex items-center justify-between rounded-2xl border border-border bg-canvas/70 px-4 py-3"
            >
              <div>
                <p class="text-sm font-medium text-surface">{{ member.user.name }}</p>
                <p class="text-[11px] text-muted">{{ member.user.email }}</p>
              </div>
              <span
                class="rounded-full border border-white/10 bg-panel px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-muted"
              >
                {{ member.role }}
              </span>
            </li>
          </ul>
        </section>

        <section class="rounded-[24px] border border-border bg-panel/75 p-5">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-surface">Boards</h2>
            <button
              type="button"
              class="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="loadTeam"
            >
              Refresh
            </button>
          </div>

          <ul class="mt-4 space-y-3">
            <li
              v-for="board in payload.boards"
              :key="board.id"
              class="flex items-center justify-between rounded-2xl border border-border bg-canvas/70 px-4 py-3"
            >
              <div>
                <p class="text-sm font-medium text-surface">{{ board.name }}</p>
                <p class="text-[11px] text-muted">
                  Updated {{ new Date(board.updatedAt).toLocaleString() }}
                </p>
              </div>
              <button
                type="button"
                class="cursor-pointer rounded-md border border-border bg-panel px-3 py-1.5 text-xs text-surface transition-colors hover:bg-hover"
                @click="openBoard(board)"
              >
                Open
              </button>
            </li>
            <li
              v-if="payload.boards.length === 0"
              class="rounded-2xl border border-dashed border-border bg-canvas/50 p-5 text-sm text-muted"
            >
              No boards attached to this team yet.
            </li>
          </ul>
        </section>
      </template>
    </div>

    <DialogRoot v-model:open="inviteOpen">
      <DialogPortal>
        <DialogOverlay :class="cls.overlay" />
        <DialogContent :class="cls.content">
          <DialogTitle :class="cls.title">Invite member</DialogTitle>
          <DialogDescription :class="cls.description">
            Add an existing Inkly user to this workspace by email.
          </DialogDescription>

          <div class="mt-4 space-y-4">
            <label class="block space-y-1.5">
              <span class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Email</span>
              <AppInput
                v-model="inviteEmail"
                test-id="team-invite-email-input"
                type="text"
                placeholder="member@example.com"
              />
            </label>

            <label class="block space-y-1.5">
              <span class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Role</span>
              <select
                v-model="inviteRole"
                data-test-id="team-invite-role-select"
                class="w-full rounded border border-border bg-input px-2 py-1.5 text-xs text-surface outline-none focus:border-accent"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>

            <div class="flex items-center justify-end gap-2">
              <button
                type="button"
                class="cursor-pointer rounded-md border border-border bg-canvas px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
                @click="inviteOpen = false"
              >
                Cancel
              </button>
              <button
                type="button"
                data-test-id="team-invite-submit"
                class="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="inviting || !inviteEmail.trim()"
                @click="inviteMember"
              >
                {{ inviting ? 'Adding…' : 'Add member' }}
              </button>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </main>
</template>
