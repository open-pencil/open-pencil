<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'

import { useI18n } from '@inkly/vue'

import { useAuthStore } from '@/app/auth/store'
import { createTeam, listTeams, type TeamSummary } from '@/app/api/teams'
import TeamCard from '@/components/TeamCard.vue'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import LoginBanner from '@/components/LoginBanner.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { useDialogUI } from '@/components/ui/dialog'
import { toast } from '@/app/shell/ui'

const { teams: teamsT } = useI18n()

useHead({ title: () => teamsT.value.headTitle })

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
const trimmedTeamName = computed(() => teamName.value.trim())
const canSubmitCreate = computed(
  () => auth.isAuthenticated && trimmedTeamName.value.length > 0 && !creating.value
)

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
    const message = error instanceof Error ? error.message : teamsT.value.toastLoadFail
    toast.error(message)
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  if (!auth.isAuthenticated) {
    toast.info(teamsT.value.toastLoginRequired)
    return
  }

  createOpen.value = true
}

async function submitCreate() {
  if (!auth.isAuthenticated) {
    toast.info(teamsT.value.toastLoginRequired)
    return
  }
  if (!canSubmitCreate.value) return

  creating.value = true
  errorMessage.value = ''

  try {
    const team = await createTeam({ name: trimmedTeamName.value })
    teams.value = [team, ...teams.value.filter((candidate) => candidate.id !== team.id)]
    createOpen.value = false
    await router.push(`/team/${team.id}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : teamsT.value.toastCreateFail
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
    const message = error instanceof Error ? error.message : teamsT.value.toastLoginFail
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
            <p class="text-[11px] font-medium uppercase tracking-[0.24em] text-accent">{{ teamsT.eyebrow }}</p>
            <h1 class="text-3xl font-semibold text-surface">{{ teamsT.heading }}</h1>
            <p class="max-w-2xl text-sm text-muted">
              {{ teamsT.subtitle }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <LocaleSwitcher test-id="teams-locale-switcher" />
            <RouterLink
              to="/"
              data-test-id="teams-home-link"
              class="inline-flex items-center gap-2 rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm text-surface transition-colors hover:bg-hover"
            >
              <icon-lucide-home class="size-4" />
              <span>トップ</span>
            </RouterLink>
            <button
              type="button"
              data-test-id="team-create-button"
              class="cursor-pointer rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
              @click="openCreateDialog"
            >
              {{ teamsT.newTeamButton }}
            </button>
          </div>
        </div>

        <LoginBanner
          v-if="showLoginBanner"
          :loading="auth.loginPending"
          :migrating="auth.migrating"
          @login="startGoogleLogin"
        />
      </section>

      <section v-if="loading" class="rounded-2xl border border-border bg-panel/70 p-6 text-sm text-muted">
        {{ teamsT.loading }}
      </section>

      <section
        v-else-if="teams.length === 0"
        class="rounded-[24px] border border-dashed border-border bg-panel/60 p-10 text-center"
      >
        <p class="text-lg font-medium text-surface">{{ teamsT.emptyHeading }}</p>
        <p class="mt-2 text-sm text-muted">
          {{ teamsT.emptyHint }}
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
        <DialogContent data-test-id="team-create-dialog" :class="cls.content">
          <DialogTitle :class="cls.title">{{ teamsT.createDialogTitle }}</DialogTitle>
          <DialogDescription :class="cls.description">
            {{ teamsT.createDialogDescription }}
          </DialogDescription>

          <div class="mt-4 space-y-4">
            <label class="block space-y-1.5">
              <span class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{{ teamsT.nameLabel }}</span>
              <AppInput v-model="teamName" test-id="team-create-input" type="text" :placeholder="teamsT.namePlaceholder" />
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
                {{ teamsT.createDialogCancel }}
              </button>
              <button
                type="button"
                data-test-id="team-create-submit"
                class="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canSubmitCreate"
                @click="submitCreate"
              >
                {{ creating ? teamsT.createDialogSubmitPending : teamsT.createDialogSubmit }}
              </button>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </main>
</template>
