<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
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

import { useI18n } from '@inkly/vue'

import { useAuthStore } from '@/app/auth/store'
import { readPinnedBoardIds, togglePinnedBoard } from '@/app/boards/pinned'
import { readBoardPreview } from '@/app/boards/preview'
import { initials, toast } from '@/app/shell/ui'
import BoardCard from '@/components/BoardCard.vue'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import LoginBanner from '@/components/LoginBanner.vue'
import NotificationBell from '@/components/NotificationBell.vue'
import AppInput from '@/components/ui/AppInput.vue'
import {
  createBoard,
  createBoardEditorLocation,
  deleteBoard,
  listBoards,
  type Board
} from '@/app/api/client'
import { listTeams, type TeamSummary } from '@/app/api/teams'
import { useDialogUI } from '@/components/ui/dialog'

const { boards: boardsT } = useI18n()

useHead({ title: () => boardsT.value.heading })

const router = useRouter()
const auth = useAuthStore()
const boards = ref<Board[]>([])
const ownedTeams = ref<TeamSummary[]>([])
const boardName = ref(boardsT.value.defaultBoardName)
const selectedTeamId = ref('personal')
const searchQuery = ref('')
const loading = ref(false)
const creating = ref(false)
const previews = ref<Record<string, string>>({})
const pinnedIds = ref<Set<string>>(new Set())
const deleteDialogOpen = ref(false)
const deleteTarget = ref<Board | null>(null)
const dialogCls = useDialogUI({
  content: 'w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-5 shadow-2xl'
})

const authDisplayName = computed(() => auth.user?.name?.trim() || auth.user?.email || 'Inkly User')
const authInitials = computed(() => initials(authDisplayName.value))
const showLoginBanner = computed(() => auth.initialized && !auth.isAuthenticated)
const showAccountLink = computed(() => auth.isAuthenticated)
const hasOwnedTeams = computed(() => ownedTeams.value.length > 0)

const filteredBoards = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const matched = query
    ? boards.value.filter((board) => board.name.toLowerCase().includes(query))
    : boards.value
  return [...matched].sort((a, b) => {
    const aPinned = pinnedIds.value.has(a.id) ? 1 : 0
    const bPinned = pinnedIds.value.has(b.id) ? 1 : 0
    if (aPinned !== bPinned) return bPinned - aPinned
    return b.updatedAt - a.updatedAt
  })
})

function handleTogglePin(board: Board) {
  const nowPinned = togglePinnedBoard(board.id)
  const next = new Set(pinnedIds.value)
  if (nowPinned) {
    next.add(board.id)
  } else {
    next.delete(board.id)
  }
  pinnedIds.value = next
}

function syncPreviews(nextBoards: Board[]) {
  previews.value = Object.fromEntries(
    nextBoards
      .map((board) => [board.id, readBoardPreview(board.id)])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
}

function syncPreviewsSoon(nextBoards: Board[]) {
  syncPreviews(nextBoards)
  requestAnimationFrame(() => {
    syncPreviews(nextBoards)
  })
  setTimeout(() => {
    syncPreviews(nextBoards)
  }, 250)
}

async function loadBoardsView() {
  loading.value = true
  try {
    boards.value = await listBoards()
    syncPreviewsSoon(boards.value)
  } catch (error) {
    const message = error instanceof Error ? error.message : boardsT.value.toastLoadFail
    toast.error(message)
    console.warn('[boards]', error)
  } finally {
    loading.value = false
  }
}

async function loadOwnedTeams() {
  if (!auth.isAuthenticated) {
    ownedTeams.value = []
    selectedTeamId.value = 'personal'
    return
  }

  try {
    const teams = await listTeams()
    ownedTeams.value = teams.filter((team) => team.role === 'owner')
  } catch (error) {
    console.warn('[teams]', error)
    ownedTeams.value = []
  }
}

async function createAndOpenBoard() {
  creating.value = true
  try {
    const board = await createBoard({
      name: boardName.value.trim() || boardsT.value.defaultBoardName,
      teamId: selectedTeamId.value === 'personal' ? null : selectedTeamId.value
    })
    boards.value = [board, ...boards.value.filter((candidate) => candidate.id !== board.id)]
    syncPreviewsSoon(boards.value)
    boardName.value = boardsT.value.defaultBoardName
    selectedTeamId.value = 'personal'
    await router.push(createBoardEditorLocation(board))
  } catch (error) {
    const message = error instanceof Error ? error.message : boardsT.value.toastCreateFail
    toast.error(message)
  } finally {
    creating.value = false
  }
}

function openBoard(board: Board) {
  void router.push(createBoardEditorLocation(board))
}

function openSettings(board: Board) {
  void router.push(`/board/${board.id}/settings`)
}

async function removeBoard(board: Board) {
  try {
    await deleteBoard(board.id)
    boards.value = boards.value.filter((candidate) => candidate.id !== board.id)
    syncPreviewsSoon(boards.value)
    toast.info('Board deleted')
  } catch (error) {
    const message = error instanceof Error ? error.message : boardsT.value.toastDeleteFail
    toast.error(message)
  }
}

function requestRemoveBoard(board: Board) {
  deleteTarget.value = board
  deleteDialogOpen.value = true
}

async function confirmRemoveBoard() {
  const board = deleteTarget.value
  deleteDialogOpen.value = false
  deleteTarget.value = null
  if (!board) return
  await removeBoard(board)
}

async function startGoogleLogin() {
  try {
    await auth.signInWithGoogle(window.location.toString())
  } catch (error) {
    const message = error instanceof Error ? error.message : boardsT.value.toastLoginFail
    toast.error(message)
  }
}

onMounted(async () => {
  await auth.init()
  pinnedIds.value = new Set(readPinnedBoardIds())
  await Promise.all([loadBoardsView(), loadOwnedTeams()])
})
</script>

<template>
  <main
    data-test-id="boards-view"
    class="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(89,140,255,0.16),transparent_30%),linear-gradient(180deg,var(--color-canvas),#0d1017)] px-6 py-10"
  >
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <section
        class="flex flex-col gap-6 rounded-[28px] border border-white/8 bg-panel/80 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div class="flex items-center justify-end gap-3">
          <LocaleSwitcher test-id="boards-locale-switcher" />
          <NotificationBell v-if="showAccountLink" />

          <RouterLink
            to="/dashboard"
            data-test-id="boards-dashboard-link"
            class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-canvas/55 px-3 py-2 text-sm text-surface transition-colors hover:bg-hover"
          >
            <icon-lucide-layout-dashboard class="size-4" />
            <span>Dashboard</span>
          </RouterLink>

          <RouterLink
            to="/teams"
            data-test-id="boards-teams-link"
            class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-canvas/55 px-3 py-2 text-sm text-surface transition-colors hover:bg-hover"
          >
            <icon-lucide-users class="size-4" />
            <span>Teams</span>
          </RouterLink>

          <RouterLink
            v-if="showAccountLink"
            to="/account"
            data-test-id="boards-account-link"
            class="inline-flex items-center gap-3 rounded-full border border-white/10 bg-canvas/55 px-3 py-2 text-sm text-surface transition-colors hover:bg-hover"
          >
            <img
              v-if="auth.user?.image"
              :src="auth.user.image"
              :alt="`${authDisplayName} avatar`"
              data-test-id="boards-account-avatar-image"
              class="size-8 rounded-full object-cover"
            />
            <span
              v-else
              data-test-id="boards-account-avatar-fallback"
              class="flex size-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(103,149,255,0.85),rgba(78,95,172,0.85))] text-[11px] font-semibold text-white"
            >
              {{ authInitials }}
            </span>
            <span>アカウント</span>
          </RouterLink>
        </div>

        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div class="space-y-2">
            <p class="text-[11px] font-medium uppercase tracking-[0.24em] text-accent">Dashboard</p>
            <h1 class="text-3xl font-semibold text-surface">{{ boardsT.heading }}</h1>
            <p class="max-w-2xl text-sm text-muted">
              {{ boardsT.subtitle }}
            </p>
          </div>

          <div class="flex w-full max-w-xl flex-col gap-2 md:items-end">
            <AppInput
              v-model="boardName"
              test-id="board-create-input"
              type="text"
              :placeholder="boardsT.boardNamePlaceholder"
            />
            <div class="flex w-full gap-2">
              <select
                v-model="selectedTeamId"
                data-test-id="board-team-select"
                class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-2 text-sm text-surface outline-none focus:border-accent"
                :aria-label="boardsT.teamSelectAriaLabel"
              >
                <option value="personal">{{ boardsT.personalBoardOption }}</option>
                <option v-for="team in ownedTeams" :key="team.id" :value="team.id">
                  {{ team.name }}
                </option>
              </select>
              <button
                type="button"
                data-test-id="board-create-button"
                class="cursor-pointer rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="creating"
                @click="createAndOpenBoard"
              >
                {{ creating ? boardsT.newBoardCreating : boardsT.newBoardButton }}
              </button>
            </div>
            <p v-if="hasOwnedTeams" class="text-[11px] text-muted">
              {{ boardsT.teamScopeHint }}
            </p>
          </div>
        </div>

        <LoginBanner
          v-if="showLoginBanner"
          :loading="auth.loginPending"
          :migrating="auth.migrating"
          @login="startGoogleLogin"
        />
      </section>

      <section class="space-y-4">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="space-y-1">
            <h2 class="text-sm font-medium text-surface">{{ boardsT.recentHeading }}</h2>
            <p class="text-xs text-muted">
              {{ boardsT.recentSubtitle }}
            </p>
          </div>
          <div class="flex w-full max-w-lg items-center gap-2">
            <AppInput
              v-model="searchQuery"
              test-id="board-search-input"
              type="search"
              :placeholder="boardsT.searchPlaceholder"
            />
            <button
              type="button"
              class="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="loadBoardsView"
            >
              Refresh
            </button>
          </div>
        </div>

        <div
          v-if="loading"
          class="rounded-2xl border border-border bg-panel/70 p-6 text-sm text-muted"
        >
          {{ boardsT.loadingBoards }}
        </div>

        <div
          v-else-if="boards.length === 0"
          class="rounded-[24px] border border-dashed border-border bg-panel/60 p-10 text-center"
        >
          <p class="text-lg font-medium text-surface">{{ boardsT.emptyHeading }}</p>
          <p class="mt-2 text-sm text-muted">
            {{ boardsT.emptyHint }}
          </p>
        </div>

        <div
          v-else-if="filteredBoards.length === 0"
          data-test-id="board-search-empty"
          class="rounded-[24px] border border-dashed border-border bg-panel/60 p-10 text-center"
        >
          <p class="text-lg font-medium text-surface">{{ boardsT.emptySearchHeading }}</p>
          <p class="mt-2 text-sm text-muted">{{ boardsT.emptySearchHint }}</p>
        </div>

        <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <BoardCard
            v-for="board in filteredBoards"
            :key="board.id"
            :board="board"
            :preview-url="previews[board.id] ?? null"
            :pinned="pinnedIds.has(board.id)"
            @open="openBoard"
            @settings="openSettings"
            @delete="requestRemoveBoard"
            @toggle-pin="handleTogglePin"
          />
        </div>
      </section>
    </div>

    <AlertDialogRoot :open="deleteDialogOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay :class="dialogCls.overlay" @click="deleteDialogOpen = false" />
        <AlertDialogContent
          data-test-id="board-delete-dialog"
          :class="dialogCls.content"
          @escape-key-down="deleteDialogOpen = false"
        >
          <AlertDialogTitle :class="dialogCls.title">{{ boardsT.deleteDialogTitle }}</AlertDialogTitle>
          <AlertDialogDescription :class="dialogCls.description">
            {{ boardsT.deleteDialogDescription }}
          </AlertDialogDescription>

          <div class="mt-4 rounded-xl border border-red-500/20 bg-red-500/8 p-3 text-xs text-red-100">
            {{ deleteTarget?.name ?? 'This board' }} will be deleted.
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <AlertDialogCancel
              data-test-id="board-delete-cancel"
              class="rounded-md border border-border bg-canvas px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="deleteDialogOpen = false"
            >
              {{ boardsT.deleteDialogCancel }}
            </AlertDialogCancel>
            <AlertDialogAction
              data-test-id="board-delete-confirm"
              class="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500/90"
              @click="confirmRemoveBoard"
            >
              {{ boardsT.deleteDialogConfirm }}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </main>
</template>
