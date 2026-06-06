<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'

import { useAuthStore } from '@/app/auth/store'
import { initials, toast } from '@/app/shell/ui'
import {
  createBoardEditorLocation,
  deleteBoard,
  listBoards,
  type Board
} from '@/app/api/client'
import { listTeams, type TeamSummary } from '@/app/api/teams'
import LoginBanner from '@/components/LoginBanner.vue'

useHead({ title: 'Admin' })

type TabKey = 'overview' | 'boards' | 'teams'

const router = useRouter()
const auth = useAuthStore()
const boards = ref<Board[]>([])
const teams = ref<TeamSummary[]>([])
const loading = ref(false)
const tab = ref<TabKey>('overview')
const searchQuery = ref('')
const teamFilter = ref<'all' | 'personal' | 'team'>('all')
const deletingBoardId = ref<string | null>(null)

const authDisplayName = computed(() => auth.user?.name?.trim() || auth.user?.email || 'Inkly User')
const authInitials = computed(() => initials(authDisplayName.value))
const showLoginBanner = computed(() => auth.initialized && !auth.isAuthenticated)

const filteredBoards = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return boards.value.filter((board) => {
    if (teamFilter.value === 'personal' && board.teamId !== null) return false
    if (teamFilter.value === 'team' && board.teamId === null) return false
    if (!query) return true
    return board.name.toLowerCase().includes(query) || board.id.includes(query)
  })
})

const ownedTeams = computed(() => teams.value.filter((team) => team.role === 'owner'))
const memberTeams = computed(() => teams.value.filter((team) => team.role !== 'owner'))

const totalBoards = computed(() => boards.value.length)
const personalBoards = computed(() => boards.value.filter((board) => board.teamId === null).length)
const teamBoards = computed(() => boards.value.filter((board) => board.teamId !== null).length)
const totalCollaborators = computed(() => {
  const ids = new Set<string>()
  for (const board of boards.value) {
    for (const collab of board.collaborators) {
      ids.add(collab.anonymousId)
    }
  }
  return ids.size
})

async function loadAdminView() {
  loading.value = true
  try {
    const [boardList, teamList] = await Promise.all([
      listBoards().catch(() => [] as Board[]),
      auth.isAuthenticated ? listTeams().catch(() => [] as TeamSummary[]) : Promise.resolve([] as TeamSummary[])
    ])
    boards.value = boardList
    teams.value = teamList
  } finally {
    loading.value = false
  }
}

async function handleDeleteBoard(board: Board) {
  if (deletingBoardId.value) return
  const confirmed = window.confirm(`Delete board "${board.name}"? This cannot be undone.`)
  if (!confirmed) return

  deletingBoardId.value = board.id
  try {
    await deleteBoard(board.id)
    boards.value = boards.value.filter((b) => b.id !== board.id)
    toast.success('Board deleted')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete board'
    toast.error(message)
  } finally {
    deletingBoardId.value = null
  }
}

function openBoard(board: Board) {
  router.push(createBoardEditorLocation(board))
}

function openTeam(team: TeamSummary) {
  router.push(`/team/${team.id}`)
}

async function startGoogleLogin() {
  try {
    await auth.signInWithGoogle(window.location.toString())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start Google login'
    toast.error(message)
  }
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

onMounted(async () => {
  await auth.init()
  await loadAdminView()
})
</script>

<template>
  <main
    data-test-id="admin-view"
    class="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(239,98,98,0.12),transparent_30%),linear-gradient(180deg,var(--color-canvas),#0d1017)] px-6 py-10"
  >
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <p class="text-[11px] font-medium uppercase tracking-[0.24em] text-[#ef6262]">Internal</p>
          <span class="text-muted">|</span>
          <h1 class="text-2xl font-semibold text-surface">Admin</h1>
        </div>
        <div class="flex items-center gap-3">
          <RouterLink
            to="/dashboard"
            data-test-id="admin-dashboard-link"
            class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-canvas/55 px-3 py-2 text-sm text-surface transition-colors hover:bg-hover"
          >
            <icon-lucide-layout-dashboard class="size-4" />
            <span>Dashboard</span>
          </RouterLink>

          <RouterLink
            v-if="auth.isAuthenticated"
            to="/account"
            data-test-id="admin-account-link"
            class="inline-flex items-center gap-3 rounded-full border border-white/10 bg-canvas/55 px-3 py-2 text-sm text-surface transition-colors hover:bg-hover"
          >
            <img
              v-if="auth.user?.image"
              :src="auth.user.image"
              :alt="`${authDisplayName} avatar`"
              data-test-id="admin-account-avatar-image"
              class="size-8 rounded-full object-cover"
            />
            <span
              v-else
              data-test-id="admin-account-avatar-fallback"
              class="flex size-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(239,98,98,0.8),rgba(139,52,52,0.85))] text-[11px] font-semibold text-white"
            >
              {{ authInitials }}
            </span>
            <span>アカウント</span>
          </RouterLink>
        </div>
      </header>

      <LoginBanner
        v-if="showLoginBanner"
        @login="startGoogleLogin"
      />

      <section
        data-test-id="admin-tabs"
        class="flex gap-2 rounded-full border border-white/8 bg-panel/80 p-1.5 shadow-lg w-fit"
      >
        <button
          type="button"
          data-test-id="admin-tab-overview"
          :class="[
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'overview'
              ? 'bg-[#ef6262]/85 text-white shadow'
              : 'text-muted hover:text-surface'
          ]"
          @click="tab = 'overview'"
        >
          Overview
        </button>
        <button
          type="button"
          data-test-id="admin-tab-boards"
          :class="[
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'boards'
              ? 'bg-[#ef6262]/85 text-white shadow'
              : 'text-muted hover:text-surface'
          ]"
          @click="tab = 'boards'"
        >
          Boards
        </button>
        <button
          type="button"
          data-test-id="admin-tab-teams"
          :class="[
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'teams'
              ? 'bg-[#ef6262]/85 text-white shadow'
              : 'text-muted hover:text-surface'
          ]"
          @click="tab = 'teams'"
        >
          Teams
        </button>
      </section>

      <section
        v-if="tab === 'overview'"
        data-test-id="admin-overview"
        class="grid grid-cols-1 gap-4 md:grid-cols-4"
      >
        <div
          data-test-id="admin-stat-total"
          class="flex flex-col gap-1 rounded-2xl border border-white/8 bg-panel/80 p-4 shadow-lg"
        >
          <p class="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">Total boards</p>
          <p class="text-2xl font-semibold text-surface">{{ totalBoards }}</p>
        </div>
        <div
          data-test-id="admin-stat-personal"
          class="flex flex-col gap-1 rounded-2xl border border-white/8 bg-panel/80 p-4 shadow-lg"
        >
          <p class="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">Personal</p>
          <p class="text-2xl font-semibold text-surface">{{ personalBoards }}</p>
        </div>
        <div
          data-test-id="admin-stat-team-boards"
          class="flex flex-col gap-1 rounded-2xl border border-white/8 bg-panel/80 p-4 shadow-lg"
        >
          <p class="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">Team boards</p>
          <p class="text-2xl font-semibold text-surface">{{ teamBoards }}</p>
        </div>
        <div
          data-test-id="admin-stat-collaborators"
          class="flex flex-col gap-1 rounded-2xl border border-white/8 bg-panel/80 p-4 shadow-lg"
        >
          <p class="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">Collaborators</p>
          <p class="text-2xl font-semibold text-surface">{{ totalCollaborators }}</p>
        </div>
      </section>

      <section
        v-else-if="tab === 'boards'"
        data-test-id="admin-boards"
        class="flex flex-col gap-4 rounded-[28px] border border-white/8 bg-panel/80 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-surface">All boards</h2>
            <p class="text-sm text-muted">{{ filteredBoards.length }} / {{ totalBoards }} shown</p>
          </div>
          <div class="flex gap-2">
            <label class="sr-only" for="admin-boards-search-input">Search boards</label>
            <input
              id="admin-boards-search-input"
              v-model="searchQuery"
              type="text"
              data-test-id="admin-boards-search"
              placeholder="Search by name or id"
              class="rounded-lg border border-border bg-input px-3 py-2 text-sm text-surface outline-none focus:border-accent w-64"
            />
            <label class="sr-only" for="admin-boards-filter-select">Filter boards by workspace</label>
            <select
              id="admin-boards-filter-select"
              v-model="teamFilter"
              data-test-id="admin-boards-filter"
              aria-label="Filter boards by workspace"
              class="rounded-lg border border-border bg-input px-2 py-2 text-sm text-surface outline-none focus:border-accent"
            >
              <option value="all">All</option>
              <option value="personal">Personal</option>
              <option value="team">Team</option>
            </select>
          </div>
        </div>

        <p
          v-if="loading"
          data-test-id="admin-boards-loading"
          class="text-sm text-muted"
        >
          Loading…
        </p>
        <p
          v-else-if="filteredBoards.length === 0"
          data-test-id="admin-boards-empty"
          class="text-sm text-muted"
        >
          No boards match the filter.
        </p>
        <div
          v-else
          data-test-id="admin-boards-table-wrap"
          class="overflow-x-auto rounded-xl border border-white/8"
        >
          <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="bg-canvas/40 text-[11px] uppercase tracking-[0.2em] text-muted">
              <tr>
                <th scope="col" class="px-3 py-2">Name</th>
                <th scope="col" class="px-3 py-2">Workspace</th>
                <th scope="col" class="px-3 py-2">Collaborators</th>
                <th scope="col" class="px-3 py-2">Updated</th>
                <th scope="col" class="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="board in filteredBoards"
                :key="board.id"
                :data-test-id="`admin-board-row-${board.id}`"
                class="border-t border-white/5 hover:bg-hover/60"
              >
                <td class="px-3 py-2 text-surface">
                  <button
                    type="button"
                    :data-test-id="`admin-board-open-${board.id}`"
                    class="hover:underline"
                    @click="openBoard(board)"
                  >
                    {{ board.name }}
                  </button>
                </td>
                <td class="px-3 py-2 text-muted">
                  <span v-if="board.team">{{ board.team.name }}</span>
                  <span v-else>Personal</span>
                </td>
                <td class="px-3 py-2 text-muted">{{ board.collaborators.length }}</td>
                <td class="px-3 py-2 text-muted">{{ formatDate(board.updatedAt) }}</td>
                <td class="px-3 py-2 text-right">
                  <button
                    type="button"
                    :data-test-id="`admin-board-delete-${board.id}`"
                    class="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    :disabled="deletingBoardId === board.id"
                    @click="handleDeleteBoard(board)"
                  >
                    <span v-if="deletingBoardId === board.id">Deleting…</span>
                    <span v-else>Delete</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        v-else-if="tab === 'teams'"
        data-test-id="admin-teams"
        class="flex flex-col gap-4 rounded-[28px] border border-white/8 bg-panel/80 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div>
          <h2 class="text-lg font-semibold text-surface">All teams</h2>
          <p class="text-sm text-muted">{{ ownedTeams.length }} owned, {{ memberTeams.length }} joined</p>
        </div>

        <div
          v-if="ownedTeams.length > 0"
          data-test-id="admin-teams-owned"
          class="flex flex-col gap-2"
        >
          <p class="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Owned</p>
          <ul class="grid grid-cols-1 gap-2 md:grid-cols-2">
            <li
              v-for="team in ownedTeams"
              :key="team.id"
              :data-test-id="`admin-team-owned-${team.id}`"
              class="cursor-pointer rounded-xl border border-white/8 bg-canvas/55 p-3 text-sm transition-colors hover:bg-hover"
              @click="openTeam(team)"
            >
              <p class="font-medium text-surface">{{ team.name }}</p>
              <p class="text-xs text-muted">{{ team.memberCount }} members</p>
            </li>
          </ul>
        </div>

        <div
          v-if="memberTeams.length > 0"
          data-test-id="admin-teams-joined"
          class="flex flex-col gap-2"
        >
          <p class="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Joined</p>
          <ul class="grid grid-cols-1 gap-2 md:grid-cols-2">
            <li
              v-for="team in memberTeams"
              :key="team.id"
              :data-test-id="`admin-team-joined-${team.id}`"
              class="cursor-pointer rounded-xl border border-white/8 bg-canvas/55 p-3 text-sm transition-colors hover:bg-hover"
              @click="openTeam(team)"
            >
              <p class="font-medium text-surface">{{ team.name }}</p>
              <p class="text-xs text-muted">{{ team.memberCount }} members · {{ team.role }}</p>
            </li>
          </ul>
        </div>

        <p
          v-if="ownedTeams.length === 0 && memberTeams.length === 0"
          data-test-id="admin-teams-empty"
          class="text-sm text-muted"
        >
          No teams found.
        </p>
      </section>
    </div>
  </main>
</template>
