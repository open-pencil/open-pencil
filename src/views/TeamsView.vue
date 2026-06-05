<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'

import { useAuthStore } from '@/app/auth/store'
import { createTeam, listTeams, type TeamSummary } from '@/app/api/teams'
import TeamCard from '@/components/TeamCard.vue'
import LoginBanner from '@/components/LoginBanner.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { useDialogUI } from '@/components/ui/dialog'
import { toast } from '@/app/shell/ui'

useHead({ title: 'Teams' })

const router = useRouter()
const auth = useAuthStore()
const teams = ref<TeamSummary[]>([])
const loading = ref(false)
const creating = ref(false)
const createOpen = ref(false)
const teamName = ref('')
const errorMessage = ref('')
const cls = useDialogUI({
  content: 'w-[min(30rem,calc(100vw-2rem))] rounded-2xl p-5 shadow-2xl'
})

const showLoginBanner = computed(() => auth.initialized && !auth.isAuthenticated)

watch(createOpen, (value) => {
  if (value) return
  teamName.value = ''
  errorMessage.value = ''
  creating.value = false
})

async function loadTeamsView() {
  loading.value = true
  try {
    teams.value = auth.isAuthenticated ? await listTeams() : []
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load teams'
    toast.error(message)
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  if (!auth.isAuthenticated) {
    toast.info('Login required')
    return
  }

  createOpen.value = true
}

async function submitCreate() {
  if (!auth.isAuthenticated) {
    toast.info('Login required')
    return
  }

  creating.value = true
  errorMessage.value = ''

  try {
    const team = await createTeam({ name: teamName.value.trim() || 'New team' })
    teams.value = [team, ...teams.value.filter((candidate) => candidate.id !== team.id)]
    createOpen.value = false
    await router.push(`/team/${team.id}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create team'
    errorMessage.value = message
    toast.error(message)
  } finally {
    creating.value = false
  }
}

async function startGoogleLogin() {
  try {
    await auth.signInWithGoogle(window.location.toString())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start Google login'
    toast.error(message)
  }
}

function openTeam(team: TeamSummary) {
  void router.push(`/team/${team.id}`)
}

function openSettings(team: TeamSummary) {
  void router.push(`/team/${team.id}/settings`)
}

onMounted(async () => {
  await auth.init()
  await loadTeamsView()
})
</script>

<template>
  <main
    data-test-id="teams-view"
    class="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,187,92,0.16),transparent_28%),linear-gradient(180deg,var(--color-canvas),#0d1118)] px-6 py-10"
  >
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <section class="rounded-[28px] border border-white/8 bg-panel/85 p-6 shadow-2xl backdrop-blur-xl">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div class="space-y-2">
            <p class="text-[11px] font-medium uppercase tracking-[0.24em] text-accent">Workspace</p>
            <h1 class="text-3xl font-semibold text-surface">Teams</h1>
            <p class="max-w-2xl text-sm text-muted">
              Share boards through a team workspace and manage roles in one place.
            </p>
          </div>

          <button
            type="button"
            data-test-id="team-create-button"
            class="cursor-pointer rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
            @click="openCreateDialog"
          >
            New team
          </button>
        </div>

        <LoginBanner
          v-if="showLoginBanner"
          :loading="auth.loginPending"
          :migrating="auth.migrating"
          @login="startGoogleLogin"
        />
      </section>

      <section v-if="loading" class="rounded-2xl border border-border bg-panel/70 p-6 text-sm text-muted">
        Loading teams…
      </section>

      <section
        v-else-if="teams.length === 0"
        class="rounded-[24px] border border-dashed border-border bg-panel/60 p-10 text-center"
      >
        <p class="text-lg font-medium text-surface">No teams yet</p>
        <p class="mt-2 text-sm text-muted">
          Create a workspace to share boards with editors and viewers.
        </p>
      </section>

      <section v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TeamCard
          v-for="team in teams"
          :key="team.id"
          :team="team"
          @open="openTeam"
          @settings="openSettings"
        />
      </section>
    </div>

    <DialogRoot v-model:open="createOpen">
      <DialogPortal>
        <DialogOverlay :class="cls.overlay" />
        <DialogContent :class="cls.content">
          <DialogTitle :class="cls.title">Create team</DialogTitle>
          <DialogDescription :class="cls.description">
            Team owners can attach boards and manage member roles.
          </DialogDescription>

          <div class="mt-4 space-y-4">
            <label class="block space-y-1.5">
              <span class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Name</span>
              <AppInput v-model="teamName" test-id="team-create-input" type="text" placeholder="Design Ops" />
            </label>

            <div
              v-if="errorMessage"
              class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100"
            >
              {{ errorMessage }}
            </div>

            <div class="flex items-center justify-end gap-2">
              <button
                type="button"
                class="cursor-pointer rounded-md border border-border bg-canvas px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
                @click="createOpen = false"
              >
                Cancel
              </button>
              <button
                type="button"
                data-test-id="team-create-submit"
                class="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="creating"
                @click="submitCreate"
              >
                {{ creating ? 'Creating…' : 'Create team' }}
              </button>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </main>
</template>
