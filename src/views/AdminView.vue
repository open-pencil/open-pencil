<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'

import { useAuthStore } from '@/app/auth/store'
import { useNotificationsStore } from '@/app/notifications/store'
import {
  formatNotificationTime,
  getNotificationBody,
  getNotificationTarget,
  getNotificationTitle
} from '@/app/notifications/format'
import { initials, toast } from '@/app/shell/ui'
import {
  createBoardEditorLocation,
  deleteBoard,
  listBoards,
  type Board
} from '@/app/api/client'
import { getTeam, listTeams, type TeamMember, type TeamSummary } from '@/app/api/teams'
import LoginBanner from '@/components/LoginBanner.vue'

useHead({ title: 'Admin' })

type TabKey = 'overview' | 'boards' | 'teams' | 'activity' | 'members'
type BoardSortKey = 'updated' | 'created' | 'name' | 'collaborators'

interface MemberWithTeam {
  member: TeamMember
  team: TeamSummary
}

const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const boards = ref<Board[]>([])
const teams = ref<TeamSummary[]>([])
const loading = ref(false)
const tab = ref<TabKey>('overview')
const searchQuery = ref('')
const teamFilter = ref<'all' | 'personal' | 'team'>('all')
const boardSort = ref<BoardSortKey>('updated')
const boardSortDirection = ref<'asc' | 'desc'>('desc')
const deletingBoardId = ref<string | null>(null)
const selectedBoardIds = ref<Set<string>>(new Set())
const bulkDeleting = ref(false)
const memberSearch = ref('')
const memberRoleFilter = ref<'all' | 'owner' | 'editor' | 'viewer'>('all')
const members = ref<MemberWithTeam[]>([])
const membersLoading = ref(false)
const membersError = ref<string | null>(null)

const authDisplayName = computed(() => auth.user?.name?.trim() || auth.user?.email || 'Inkly User')
const authInitials = computed(() => initials(authDisplayName.value))
const showLoginBanner = computed(() => auth.initialized && !auth.isAuthenticated)

const filteredBoards = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const filtered = boards.value.filter((board) => {
    if (teamFilter.value === 'personal' && board.teamId !== null) return false
    if (teamFilter.value === 'team' && board.teamId === null) return false
    if (!query) return true
    return board.name.toLowerCase().includes(query) || board.id.includes(query)
  })

  const sorted = [...filtered]
  sorted.sort((a, b) => {
    let aValue: number | string
    let bValue: number | string
    switch (boardSort.value) {
      case 'name':
        aValue = a.name.toLowerCase()
        bValue = b.name.toLowerCase()
        break
      case 'created':
        aValue = a.createdAt
        bValue = b.createdAt
        break
      case 'collaborators':
        aValue = a.collaborators.length
        bValue = b.collaborators.length
        break
      case 'updated':
      default:
        aValue = a.updatedAt
        bValue = b.updatedAt
    }

    if (aValue < bValue) return boardSortDirection.value === 'asc' ? -1 : 1
    if (aValue > bValue) return boardSortDirection.value === 'asc' ? 1 : -1
    return 0
  })
  return sorted
})

function toggleSort(key: BoardSortKey) {
  if (boardSort.value === key) {
    boardSortDirection.value = boardSortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    boardSort.value = key
    boardSortDirection.value = key === 'name' ? 'asc' : 'desc'
  }
}

const activityItems = computed(() => notifications.items.slice(0, 50))

const filteredMembers = computed(() => {
  const query = memberSearch.value.trim().toLowerCase()
  return members.value.filter(({ member }) => {
    if (memberRoleFilter.value !== 'all' && member.role !== memberRoleFilter.value) return false
    if (!query) return true
    const haystack = [
      member.user.name,
      member.user.email,
      member.role
    ].join(' ').toLowerCase()
    return haystack.includes(query)
  })
})

const memberRoleCounts = computed(() => {
  const counts = { owner: 0, editor: 0, viewer: 0 }
  for (const entry of members.value) {
    counts[entry.member.role]++
  }
  return counts
})

async function loadMembers() {
  if (membersLoading.value) return
  membersLoading.value = true
  membersError.value = null
  try {
    const teamList = teams.value.length > 0 ? teams.value : await listTeams().catch(() => [])
    if (teams.value.length === 0) teams.value = teamList

    const detailResults = await Promise.allSettled(
      teamList.map((team) => getTeam(team.id))
    )

    const collected: MemberWithTeam[] = []
    for (let i = 0; i < detailResults.length; i++) {
      const result = detailResults[i]
      if (result.status !== 'fulfilled') continue
      const team = teamList[i]
      for (const member of result.value.members) {
        collected.push({ member, team })
      }
    }
    members.value = collected
  } catch (error) {
    membersError.value = error instanceof Error ? error.message : 'Failed to load members'
  } finally {
    membersLoading.value = false
  }
}

async function activateTab(next: TabKey) {
  tab.value = next
  if (next === 'members' && auth.isAuthenticated && members.value.length === 0 && !membersLoading.value) {
    await loadMembers()
  }
}

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

function openActivity(notificationId: string) {
  const record = notifications.items.find((item) => item.id === notificationId)
  if (!record) return
  router.push(getNotificationTarget(record))
}

function escapeCsvField(value: string | number): string {
  const text = String(value)
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function exportBoardsCsv() {
  const header = ['Id', 'Name', 'Workspace', 'Collaborators', 'Created', 'Updated']
  const rows = filteredBoards.value.map((board) => [
    board.id,
    board.name,
    board.team?.name ?? 'Personal',
    String(board.collaborators.length),
    new Date(board.createdAt).toISOString(),
    new Date(board.updatedAt).toISOString()
  ])

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsvField).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `inkly-boards-${Date.now()}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success(`Exported ${rows.length} board${rows.length === 1 ? '' : 's'}`)
}

async function handleDeleteBoard(board: Board) {
  if (deletingBoardId.value) return
  const confirmed = window.confirm(`Delete board "${board.name}"? This cannot be undone.`)
  if (!confirmed) return

  deletingBoardId.value = board.id
  try {
    await deleteBoard(board.id)
    boards.value = boards.value.filter((b) => b.id !== board.id)
    selectedBoardIds.value.delete(board.id)
    selectedBoardIds.value = new Set(selectedBoardIds.value)
    toast.success('Board deleted')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete board'
    toast.error(message)
  } finally {
    deletingBoardId.value = null
  }
}

function toggleBoardSelection(boardId: string) {
  const next = new Set(selectedBoardIds.value)
  if (next.has(boardId)) {
    next.delete(boardId)
  } else {
    next.add(boardId)
  }
  selectedBoardIds.value = next
}

const allFilteredSelected = computed(() => {
  if (filteredBoards.value.length === 0) return false
  return filteredBoards.value.every((board) => selectedBoardIds.value.has(board.id))
})

function toggleSelectAllFiltered() {
  const next = new Set(selectedBoardIds.value)
  if (allFilteredSelected.value) {
    for (const board of filteredBoards.value) next.delete(board.id)
  } else {
    for (const board of filteredBoards.value) next.add(board.id)
  }
  selectedBoardIds.value = next
}

function clearBoardSelection() {
  selectedBoardIds.value = new Set()
}

async function handleBulkDelete() {
  if (bulkDeleting.value) return
  if (selectedBoardIds.value.size === 0) return
  const count = selectedBoardIds.value.size
  const confirmed = window.confirm(
    `Delete ${count} selected board${count === 1 ? '' : 's'}? This cannot be undone.`
  )
  if (!confirmed) return

  bulkDeleting.value = true
  const targets = [...selectedBoardIds.value]
  const results = await Promise.allSettled(targets.map((id) => deleteBoard(id)))

  const succeeded = new Set<string>()
  let failed = 0
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      succeeded.add(targets[i])
    } else {
      failed++
    }
  }

  boards.value = boards.value.filter((b) => !succeeded.has(b.id))
  const remaining = new Set(selectedBoardIds.value)
  for (const id of succeeded) remaining.delete(id)
  selectedBoardIds.value = remaining
  bulkDeleting.value = false

  if (succeeded.size > 0) {
    toast.success(`Deleted ${succeeded.size} board${succeeded.size === 1 ? '' : 's'}`)
  }
  if (failed > 0) {
    toast.error(`Failed to delete ${failed} board${failed === 1 ? '' : 's'}`)
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
  await notifications.mount()
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
          @click="activateTab('overview')"
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
          @click="activateTab('boards')"
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
          @click="activateTab('teams')"
        >
          Teams
        </button>
        <button
          type="button"
          data-test-id="admin-tab-activity"
          :class="[
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'activity'
              ? 'bg-[#ef6262]/85 text-white shadow'
              : 'text-muted hover:text-surface'
          ]"
          @click="activateTab('activity')"
        >
          Activity
        </button>
        <button
          type="button"
          data-test-id="admin-tab-members"
          :class="[
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'members'
              ? 'bg-[#ef6262]/85 text-white shadow'
              : 'text-muted hover:text-surface'
          ]"
          @click="activateTab('members')"
        >
          Members
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
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-if="selectedBoardIds.size > 0"
              type="button"
              data-test-id="admin-boards-bulk-delete"
              :disabled="bulkDeleting"
              class="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              @click="handleBulkDelete"
            >
              <icon-lucide-trash class="size-4" />
              <span>
                <span v-if="bulkDeleting">Deleting…</span>
                <span v-else>Delete {{ selectedBoardIds.size }}</span>
              </span>
            </button>
            <button
              v-if="selectedBoardIds.size > 0"
              type="button"
              data-test-id="admin-boards-clear-selection"
              class="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-canvas/60 px-3 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="clearBoardSelection"
            >
              Clear
            </button>
            <button
              type="button"
              data-test-id="admin-boards-export"
              :disabled="filteredBoards.length === 0"
              class="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-canvas/60 px-3 py-2 text-sm text-surface transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
              @click="exportBoardsCsv"
            >
              <icon-lucide-download class="size-4" />
              <span>Export CSV</span>
            </button>
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
                <th scope="col" class="w-10 px-3 py-2">
                  <label class="sr-only" for="admin-boards-select-all">Select all visible boards</label>
                  <input
                    id="admin-boards-select-all"
                    type="checkbox"
                    data-test-id="admin-boards-select-all"
                    :checked="allFilteredSelected"
                    aria-label="Select all visible boards"
                    class="size-4 cursor-pointer accent-[#ef6262]"
                    @change="toggleSelectAllFiltered"
                  />
                </th>
                <th scope="col" class="px-3 py-2">
                  <button
                    type="button"
                    data-test-id="admin-boards-sort-name"
                    class="inline-flex items-center gap-1 hover:text-surface"
                    @click="toggleSort('name')"
                  >
                    Name
                    <span v-if="boardSort === 'name'" aria-hidden="true">{{ boardSortDirection === 'asc' ? '↑' : '↓' }}</span>
                  </button>
                </th>
                <th scope="col" class="px-3 py-2">Workspace</th>
                <th scope="col" class="px-3 py-2">
                  <button
                    type="button"
                    data-test-id="admin-boards-sort-collaborators"
                    class="inline-flex items-center gap-1 hover:text-surface"
                    @click="toggleSort('collaborators')"
                  >
                    Collaborators
                    <span v-if="boardSort === 'collaborators'" aria-hidden="true">{{ boardSortDirection === 'asc' ? '↑' : '↓' }}</span>
                  </button>
                </th>
                <th scope="col" class="px-3 py-2">
                  <button
                    type="button"
                    data-test-id="admin-boards-sort-created"
                    class="inline-flex items-center gap-1 hover:text-surface"
                    @click="toggleSort('created')"
                  >
                    Created
                    <span v-if="boardSort === 'created'" aria-hidden="true">{{ boardSortDirection === 'asc' ? '↑' : '↓' }}</span>
                  </button>
                </th>
                <th scope="col" class="px-3 py-2">
                  <button
                    type="button"
                    data-test-id="admin-boards-sort-updated"
                    class="inline-flex items-center gap-1 hover:text-surface"
                    @click="toggleSort('updated')"
                  >
                    Updated
                    <span v-if="boardSort === 'updated'" aria-hidden="true">{{ boardSortDirection === 'asc' ? '↑' : '↓' }}</span>
                  </button>
                </th>
                <th scope="col" class="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="board in filteredBoards"
                :key="board.id"
                :data-test-id="`admin-board-row-${board.id}`"
                :class="[
                  'border-t border-white/5 transition-colors',
                  selectedBoardIds.has(board.id) ? 'bg-[#ef6262]/5' : 'hover:bg-hover/60'
                ]"
              >
                <td class="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    :data-test-id="`admin-board-select-${board.id}`"
                    :checked="selectedBoardIds.has(board.id)"
                    :aria-label="`Select ${board.name}`"
                    class="size-4 cursor-pointer accent-[#ef6262]"
                    @change="toggleBoardSelection(board.id)"
                  />
                </td>
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
                <td class="px-3 py-2 text-muted">{{ formatDate(board.createdAt) }}</td>
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

      <section
        v-else-if="tab === 'activity'"
        data-test-id="admin-activity"
        class="flex flex-col gap-4 rounded-[28px] border border-white/8 bg-panel/80 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div>
          <h2 class="text-lg font-semibold text-surface">Activity</h2>
          <p class="text-sm text-muted">
            Recent notifications (invitations, mentions). Latest 50 records.
          </p>
        </div>

        <p
          v-if="activityItems.length === 0"
          data-test-id="admin-activity-empty"
          class="text-sm text-muted"
        >
          No activity recorded.
        </p>
        <ul
          v-else
          data-test-id="admin-activity-list"
          class="flex flex-col gap-2"
        >
          <li
            v-for="record in activityItems"
            :key="record.id"
            :data-test-id="`admin-activity-${record.id}`"
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-canvas/55 p-3 transition-colors hover:bg-hover"
            @click="openActivity(record.id)"
          >
            <div
              v-if="record.readAt === null"
              class="mt-1.5 size-2 shrink-0 rounded-full bg-[#ef6262]"
              aria-hidden="true"
            />
            <div
              v-else
              class="mt-1.5 size-2 shrink-0 rounded-full bg-muted/30"
              aria-hidden="true"
            />
            <div class="flex flex-1 flex-col gap-1">
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-medium text-surface">{{ getNotificationTitle(record) }}</p>
                <span class="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted">
                  {{ record.type }}
                </span>
              </div>
              <p class="text-xs text-muted">{{ getNotificationBody(record) }}</p>
              <p class="text-[11px] text-muted">{{ formatNotificationTime(record) }}</p>
            </div>
          </li>
        </ul>
      </section>

      <section
        v-else-if="tab === 'members'"
        data-test-id="admin-members"
        class="flex flex-col gap-4 rounded-[28px] border border-white/8 bg-panel/80 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-surface">All members</h2>
            <p class="text-sm text-muted">
              {{ filteredMembers.length }} / {{ members.length }} shown · owners {{ memberRoleCounts.owner }} · editors {{ memberRoleCounts.editor }} · viewers {{ memberRoleCounts.viewer }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <label class="sr-only" for="admin-members-search-input">Search members</label>
            <input
              id="admin-members-search-input"
              v-model="memberSearch"
              type="text"
              data-test-id="admin-members-search"
              placeholder="Search by name, email or role"
              class="rounded-lg border border-border bg-input px-3 py-2 text-sm text-surface outline-none focus:border-accent w-64"
            />
            <label class="sr-only" for="admin-members-role-select">Filter members by role</label>
            <select
              id="admin-members-role-select"
              v-model="memberRoleFilter"
              data-test-id="admin-members-role"
              aria-label="Filter members by role"
              class="rounded-lg border border-border bg-input px-2 py-2 text-sm text-surface outline-none focus:border-accent"
            >
              <option value="all">All roles</option>
              <option value="owner">Owner</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>

        <p
          v-if="membersLoading"
          data-test-id="admin-members-loading"
          class="text-sm text-muted"
        >
          Loading members…
        </p>
        <p
          v-else-if="membersError"
          data-test-id="admin-members-error"
          class="text-sm text-red-300"
        >
          {{ membersError }}
        </p>
        <p
          v-else-if="filteredMembers.length === 0"
          data-test-id="admin-members-empty"
          class="text-sm text-muted"
        >
          No members match the filter.
        </p>
        <div
          v-else
          data-test-id="admin-members-table-wrap"
          class="overflow-x-auto rounded-xl border border-white/8"
        >
          <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="bg-canvas/40 text-[11px] uppercase tracking-[0.2em] text-muted">
              <tr>
                <th scope="col" class="px-3 py-2">Name</th>
                <th scope="col" class="px-3 py-2">Email</th>
                <th scope="col" class="px-3 py-2">Team</th>
                <th scope="col" class="px-3 py-2">Role</th>
                <th scope="col" class="px-3 py-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in filteredMembers"
                :key="`${entry.team.id}-${entry.member.userId}`"
                :data-test-id="`admin-member-row-${entry.team.id}-${entry.member.userId}`"
                class="border-t border-white/5 hover:bg-hover/60"
              >
                <td class="px-3 py-2 text-surface">{{ entry.member.user.name || '—' }}</td>
                <td class="px-3 py-2 text-muted">{{ entry.member.user.email }}</td>
                <td class="px-3 py-2 text-muted">
                  <RouterLink
                    :to="`/team/${entry.team.id}`"
                    :data-test-id="`admin-member-team-link-${entry.team.id}-${entry.member.userId}`"
                    class="hover:underline"
                  >
                    {{ entry.team.name }}
                  </RouterLink>
                </td>
                <td class="px-3 py-2">
                  <span
                    :class="[
                      'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]',
                      entry.member.role === 'owner'
                        ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
                        : entry.member.role === 'editor'
                          ? 'border-accent/30 bg-accent/10 text-accent'
                          : 'border-white/10 bg-canvas/55 text-muted'
                    ]"
                  >
                    {{ entry.member.role }}
                  </span>
                </td>
                <td class="px-3 py-2 text-muted">{{ formatDate(entry.member.addedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </main>
</template>
