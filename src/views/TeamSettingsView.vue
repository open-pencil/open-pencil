<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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

import {
  deleteTeam,
  getTeam,
  removeTeamMember,
  updateTeam,
  updateTeamMemberRole,
  type TeamDetailResponse
} from '@/app/api/teams'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { toast } from '@/app/shell/ui'
import { useDialogUI } from '@/components/ui/dialog'

const route = useRoute()
const router = useRouter()
const payload = ref<TeamDetailResponse | null>(null)
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const errorMessage = ref('')
const teamName = ref('')
const roleDialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const pendingRoleChange = ref<{
  userId: string
  name: string
  email: string
  role: Exclude<TeamDetailResponse['members'][number]['role'], 'owner'>
} | null>(null)
const dialogCls = useDialogUI({
  content: 'w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-5 shadow-2xl'
})

const teamId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const isOwner = computed(() => payload.value?.team.role === 'owner')

useHead({
  title: computed(() => (payload.value ? `${payload.value.team.name} Settings` : 'Team Settings'))
})

async function loadSettings() {
  if (!teamId.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    payload.value = await getTeam(teamId.value)
    teamName.value = payload.value.team.name
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load team settings'
    errorMessage.value = message
    toast.error(message)
  } finally {
    loading.value = false
  }
}

async function saveTeamName() {
  if (!teamId.value) return
  saving.value = true

  try {
    await updateTeam(teamId.value, { name: teamName.value.trim() || 'Team' })
    await loadSettings()
    toast.info('Team updated')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update team'
    toast.error(message)
  } finally {
    saving.value = false
  }
}

async function changeRole(userId: string, role: 'editor' | 'viewer') {
  if (!teamId.value) return

  try {
    await updateTeamMemberRole(teamId.value, userId, role)
    await loadSettings()
    toast.info('Member role updated')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update member role'
    toast.error(message)
  }
}

function onRoleChange(member: TeamDetailResponse['members'][number], event: Event) {
  const nextRole = (event.target as HTMLSelectElement).value
  if (nextRole === 'editor' || nextRole === 'viewer') {
    pendingRoleChange.value = {
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      role: nextRole
    }
    ;(event.target as HTMLSelectElement).value = member.role === 'owner' ? 'owner' : member.role
    roleDialogOpen.value = true
  }
}

async function confirmRoleChange() {
  const pending = pendingRoleChange.value
  roleDialogOpen.value = false
  pendingRoleChange.value = null
  if (!pending) return
  await changeRole(pending.userId, pending.role)
}

async function removeMember(userId: string) {
  if (!teamId.value) return
  if (!window.confirm('Remove this member from the team?')) return

  try {
    await removeTeamMember(teamId.value, userId)
    await loadSettings()
    toast.info('Member removed')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove member'
    toast.error(message)
  }
}

async function destroyTeam() {
  if (!teamId.value) return
  deleting.value = true

  try {
    await deleteTeam(teamId.value)
    toast.info('Team deleted')
    await router.push('/teams')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete team'
    toast.error(message)
  } finally {
    deleting.value = false
  }
}

function requestDeleteTeam() {
  deleteDialogOpen.value = true
}

async function confirmDeleteTeam() {
  deleteDialogOpen.value = false
  await destroyTeam()
}

onMounted(() => {
  void loadSettings()
})
</script>

<template>
  <main
    data-test-id="team-settings-view"
    class="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,165,92,0.14),transparent_28%),linear-gradient(180deg,var(--color-canvas),#0c1119)] px-6 py-10"
  >
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section class="rounded-[28px] border border-white/8 bg-panel/85 p-6 shadow-2xl backdrop-blur-xl">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div class="space-y-2">
            <button
              type="button"
              class="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="router.push(`/team/${teamId}`)"
            >
              Back to team
            </button>
            <h1 class="text-3xl font-semibold text-surface">
              {{ payload?.team.name ?? 'Team settings' }}
            </h1>
            <p class="text-sm text-muted">Rename the team, manage roles, or delete the workspace.</p>
          </div>
          <LocaleSwitcher test-id="team-settings-locale-switcher" />
        </div>
      </section>

      <section v-if="loading" class="rounded-2xl border border-border bg-panel/70 p-6 text-sm text-muted">
        Loading settings…
      </section>

      <section
        v-else-if="errorMessage"
        class="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-100"
      >
        {{ errorMessage }}
      </section>

      <template v-else-if="payload">
        <section class="rounded-[24px] border border-border bg-panel/75 p-5">
          <div class="space-y-4">
            <div v-if="!isOwner" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              Only the team owner can change settings.
            </div>

            <label class="block space-y-1.5">
              <span class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Team name</span>
              <AppInput v-model="teamName" test-id="team-settings-name-input" type="text" :disabled="!isOwner || saving" />
            </label>

            <div class="flex justify-end">
              <button
                type="button"
                data-test-id="team-settings-save"
                class="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!isOwner || saving"
                @click="saveTeamName"
              >
                {{ saving ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </div>
        </section>

        <section class="rounded-[24px] border border-border bg-panel/75 p-5">
          <h2 class="text-lg font-semibold text-surface">Member roles</h2>
          <ul class="mt-4 space-y-3">
            <li
              v-for="member in payload.members"
              :key="member.userId"
              class="flex flex-col gap-3 rounded-2xl border border-border bg-canvas/70 px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p class="text-sm font-medium text-surface">{{ member.user.name }}</p>
                <p class="text-[11px] text-muted">{{ member.user.email }}</p>
              </div>

              <div class="flex items-center gap-2">
                <select
                  :value="member.role === 'owner' ? 'owner' : member.role"
                  data-test-id="team-settings-role-select"
                  class="rounded border border-border bg-input px-2 py-1.5 text-xs text-surface outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!isOwner || member.role === 'owner'"
                  @change="onRoleChange(member, $event)"
                >
                  <option value="owner">Owner</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="button"
                  data-test-id="team-settings-remove-member"
                  class="cursor-pointer rounded-md px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!isOwner || member.role === 'owner'"
                  @click="removeMember(member.userId)"
                >
                  Remove
                </button>
              </div>
            </li>
          </ul>
        </section>

        <section class="rounded-[24px] border border-red-500/20 bg-red-500/5 p-5">
          <h2 class="text-lg font-semibold text-surface">Danger zone</h2>
          <p class="mt-2 text-sm text-muted">
            Deleting the team removes memberships and returns team boards to personal ownership.
          </p>
          <div class="mt-4 flex justify-end">
            <button
              type="button"
              data-test-id="team-settings-delete"
              class="cursor-pointer rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500/90 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!isOwner || deleting"
              @click="requestDeleteTeam"
            >
              {{ deleting ? 'Deleting…' : 'Delete team' }}
            </button>
          </div>
        </section>
      </template>
    </div>

    <AlertDialogRoot :open="roleDialogOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay :class="dialogCls.overlay" @click="roleDialogOpen = false" />
        <AlertDialogContent
          data-test-id="team-settings-role-dialog"
          :class="dialogCls.content"
          @escape-key-down="roleDialogOpen = false"
        >
          <AlertDialogTitle :class="dialogCls.title">Change member role</AlertDialogTitle>
          <AlertDialogDescription :class="dialogCls.description">
            {{ pendingRoleChange?.name ?? 'This member' }} will become
            {{ pendingRoleChange?.role ?? 'editor' }} on this team.
          </AlertDialogDescription>

          <div class="mt-4 rounded-xl border border-border bg-canvas/70 p-3">
            <p class="text-sm font-medium text-surface">{{ pendingRoleChange?.name }}</p>
            <p class="text-xs text-muted">{{ pendingRoleChange?.email }}</p>
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <AlertDialogCancel
              class="rounded-md border border-border bg-canvas px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="roleDialogOpen = false"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-test-id="team-settings-role-confirm"
              class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90"
              @click="confirmRoleChange"
            >
              Apply role
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>

    <AlertDialogRoot :open="deleteDialogOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay :class="dialogCls.overlay" @click="deleteDialogOpen = false" />
        <AlertDialogContent
          data-test-id="team-settings-delete-dialog"
          :class="dialogCls.content"
          @escape-key-down="deleteDialogOpen = false"
        >
          <AlertDialogTitle :class="dialogCls.title">Delete team</AlertDialogTitle>
          <AlertDialogDescription :class="dialogCls.description">
            Delete this team and move its boards back to personal ownership. This cannot be undone.
          </AlertDialogDescription>

          <div class="mt-4 rounded-xl border border-red-500/20 bg-red-500/8 p-3 text-xs text-red-100">
            {{ payload?.team.name ?? 'This team' }} and its memberships will be removed.
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <AlertDialogCancel
              class="rounded-md border border-border bg-canvas px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="deleteDialogOpen = false"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-test-id="team-settings-delete-confirm"
              class="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500/90"
              @click="confirmDeleteTeam"
            >
              Delete team
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </main>
</template>
