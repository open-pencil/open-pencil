<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'

import { useI18n } from '@inkly/vue'

import { formatTemplate } from '@/app/shell/i18n-format'
import { useAuthStore } from '@/app/auth/store'
import { readPinnedBoardIds, togglePinnedBoard } from '@/app/boards/pinned'
import { readBoardPreview } from '@/app/boards/preview'
import {
  DEFAULT_DASHBOARD_LAYOUT,
  moveSection,
  readDashboardLayout,
  reorderSection,
  resetDashboardLayout,
  toggleSection,
  writeDashboardLayout,
  type DashboardSectionConfig,
  type DashboardSectionId
} from '@/app/shell/dashboard-layout'
import { useNotificationsStore } from '@/app/notifications/store'
import {
  formatNotificationTime,
  getNotificationBody,
  getNotificationTarget,
  getNotificationTitle
} from '@/app/notifications/format'
import { initials, toast } from '@/app/shell/ui'
import {
  createBoard,
  createBoardEditorLocation,
  listBoards,
  type Board
} from '@/app/api/client'
import { listTeams, type TeamSummary } from '@/app/api/teams'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import LoginBanner from '@/components/LoginBanner.vue'
import NotificationBell from '@/components/NotificationBell.vue'

const { dashboard, notificationsFormat: notificationsFormatT } = useI18n()

useHead({ title: () => dashboard.value.title })

const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const boards = ref<Board[]>([])
const teams = ref<TeamSummary[]>([])
const loading = ref(false)
const creating = ref(false)
const previews = ref<Record<string, string>>({})
const pinnedIds = ref<Set<string>>(new Set())
const layout = ref<DashboardSectionConfig[]>(DEFAULT_DASHBOARD_LAYOUT.slice())
const customizing = ref(false)
const layoutMap = computed(() => {
  const map = new Map<DashboardSectionId, DashboardSectionConfig>()
  for (const section of layout.value) {
    map.set(section.id, section)
  }
  return map
})
function isSectionEnabled(id: DashboardSectionId) {
  return layoutMap.value.get(id)?.enabled ?? true
}
function indexOfSection(id: DashboardSectionId) {
  return layout.value.findIndex((section) => section.id === id)
}
function handleToggleSection(id: DashboardSectionId) {
  const next = toggleSection(layout.value, id)
  layout.value = next
  writeDashboardLayout(next)
}
function handleMoveSection(id: DashboardSectionId, direction: 'up' | 'down') {
  const next = moveSection(layout.value, id, direction)
  if (next === layout.value) return
  layout.value = next
  writeDashboardLayout(next)
}
function handleResetLayout() {
  resetDashboardLayout()
  layout.value = DEFAULT_DASHBOARD_LAYOUT.slice()
}

const draggingSectionId = ref<DashboardSectionId | null>(null)
const dragAnnouncement = ref('')
const keyboardGrabbedId = ref<DashboardSectionId | null>(null)

function handleDragStart(id: DashboardSectionId, event: DragEvent) {
  draggingSectionId.value = id
  dragAnnouncement.value = formatTemplate(dashboard.value.customize.dragStartAnnounce, {
    section: sectionLabel(id)
  })
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }
}

function handleDragOver(event: DragEvent) {
  if (!draggingSectionId.value) return
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function handleDrop(targetId: DashboardSectionId) {
  const fromId = draggingSectionId.value
  draggingSectionId.value = null
  if (!fromId) return
  if (fromId === targetId) {
    dragAnnouncement.value = formatTemplate(dashboard.value.customize.dragCancelAnnounce, {
      section: sectionLabel(fromId)
    })
    return
  }
  const next = reorderSection(layout.value, fromId, targetId)
  if (next === layout.value) {
    dragAnnouncement.value = formatTemplate(dashboard.value.customize.dragCancelAnnounce, {
      section: sectionLabel(fromId)
    })
    return
  }
  layout.value = next
  writeDashboardLayout(next)
  dragAnnouncement.value = formatTemplate(dashboard.value.customize.dragDropAnnounce, {
    section: sectionLabel(fromId),
    target: sectionLabel(targetId)
  })
}

function handleDragEnd() {
  if (draggingSectionId.value) {
    dragAnnouncement.value = formatTemplate(dashboard.value.customize.dragCancelAnnounce, {
      section: sectionLabel(draggingSectionId.value)
    })
  }
  draggingSectionId.value = null
}

function announceKeyboardPickup(id: DashboardSectionId) {
  dragAnnouncement.value = formatTemplate(dashboard.value.customize.keyboardPickupAnnounce, {
    section: sectionLabel(id)
  })
}

function announceKeyboardMove(id: DashboardSectionId) {
  const index = indexOfSection(id)
  if (index === -1) return
  dragAnnouncement.value = formatTemplate(dashboard.value.customize.keyboardMoveAnnounce, {
    section: sectionLabel(id),
    position: index + 1,
    total: layout.value.length
  })
}

function announceKeyboardDrop(id: DashboardSectionId) {
  dragAnnouncement.value = formatTemplate(dashboard.value.customize.keyboardDropAnnounce, {
    section: sectionLabel(id)
  })
}

function announceKeyboardCancel(id: DashboardSectionId) {
  dragAnnouncement.value = formatTemplate(dashboard.value.customize.keyboardCancelAnnounce, {
    section: sectionLabel(id)
  })
}

function handleRowKeydown(id: DashboardSectionId, event: KeyboardEvent) {
  if (event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault()
    if (keyboardGrabbedId.value === id) {
      keyboardGrabbedId.value = null
      announceKeyboardDrop(id)
      return
    }
    keyboardGrabbedId.value = id
    announceKeyboardPickup(id)
    return
  }

  if (event.key === 'Enter') {
    if (keyboardGrabbedId.value === id) {
      event.preventDefault()
      keyboardGrabbedId.value = null
      announceKeyboardDrop(id)
    }
    return
  }

  if (event.key === 'Escape') {
    if (keyboardGrabbedId.value === id) {
      event.preventDefault()
      announceKeyboardCancel(id)
      keyboardGrabbedId.value = null
    }
    return
  }

  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  if (keyboardGrabbedId.value !== id) return

  event.preventDefault()
  const direction = event.key === 'ArrowUp' ? 'up' : 'down'
  const next = moveSection(layout.value, id, direction)
  if (next === layout.value) return
  layout.value = next
  writeDashboardLayout(next)
  announceKeyboardMove(id)
}
function sectionLabel(id: DashboardSectionId): string {
  const map: Record<DashboardSectionId, string> = {
    metrics: dashboard.value.customize.sectionMetrics,
    quickActions: dashboard.value.customize.sectionQuickActions,
    pinned: dashboard.value.customize.sectionPinned,
    recent: dashboard.value.customize.sectionRecent,
    activity: dashboard.value.customize.sectionActivity
  }
  return map[id]
}

const authDisplayName = computed(() => auth.user?.name?.trim() || auth.user?.email || 'Inkly User')
const authInitials = computed(() => initials(authDisplayName.value))
const showLoginBanner = computed(() => auth.initialized && !auth.isAuthenticated)
const showAccountLink = computed(() => auth.isAuthenticated)

const recentBoards = computed(() => {
  const sorted = [...boards.value].sort((a, b) => b.updatedAt - a.updatedAt)
  return sorted.slice(0, 6)
})

const pinnedBoards = computed(() => {
  return boards.value.filter((board) => pinnedIds.value.has(board.id))
})

const personalBoardCount = computed(() => boards.value.filter((board) => board.teamId === null).length)
const teamBoardCount = computed(() => boards.value.filter((board) => board.teamId !== null).length)
const totalTeams = computed(() => teams.value.length)
const totalUnread = computed(() => notifications.unreadCount)
const latestNotifications = computed(() => notifications.latest)

function syncPreviews(nextBoards: Board[]) {
  previews.value = Object.fromEntries(
    nextBoards
      .map((board) => [board.id, readBoardPreview(board.id)])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
}

async function loadDashboardView() {
  loading.value = true
  try {
    const [boardList, teamList] = await Promise.all([
      listBoards().catch((error) => {
        console.warn('[dashboard]', 'listBoards failed', error)
        return [] as Board[]
      }),
      auth.isAuthenticated
        ? listTeams().catch((error) => {
            console.warn('[dashboard]', 'listTeams failed', error)
            return [] as TeamSummary[]
          })
        : Promise.resolve([] as TeamSummary[])
    ])
    boards.value = boardList
    teams.value = teamList
    syncPreviews(boardList)
  } finally {
    loading.value = false
  }
}

async function createQuickBoard() {
  if (creating.value) return
  creating.value = true
  try {
    const board = await createBoard({ name: 'Untitled board' })
    boards.value = [board, ...boards.value]
    router.push(createBoardEditorLocation(board))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create board'
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

function openBoard(board: Board) {
  router.push(createBoardEditorLocation(board))
}

function handleTogglePin(boardId: string, event: Event) {
  event.stopPropagation()
  const nowPinned = togglePinnedBoard(boardId)
  const next = new Set(pinnedIds.value)
  if (nowPinned) {
    next.add(boardId)
  } else {
    next.delete(boardId)
  }
  pinnedIds.value = next
}

function isPinned(boardId: string) {
  return pinnedIds.value.has(boardId)
}

function openNotification(notificationId: string) {
  const notification = notifications.items.find((candidate) => candidate.id === notificationId)
  if (!notification) return
  router.push(getNotificationTarget(notification))
}

function formatRelativeUpdate(timestamp: number) {
  const diffMs = Date.now() - timestamp
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(timestamp).toLocaleDateString()
}

onMounted(async () => {
  await auth.init()
  await notifications.mount()
  pinnedIds.value = new Set(readPinnedBoardIds())
  layout.value = readDashboardLayout()
  await loadDashboardView()
})
</script>

<template>
  <main
    data-test-id="dashboard-view"
    class="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(89,140,255,0.16),transparent_30%),linear-gradient(180deg,var(--color-canvas),#0d1017)] px-6 py-10"
  >
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <p class="text-[11px] font-medium uppercase tracking-[0.24em] text-accent">{{ dashboard.brand }}</p>
          <span class="text-muted">|</span>
          <h1 class="text-2xl font-semibold text-surface">{{ dashboard.title }}</h1>
        </div>
        <div class="flex items-center gap-3">
          <LocaleSwitcher test-id="dashboard-locale-switcher" />
          <NotificationBell v-if="showAccountLink" />

          <button
            type="button"
            data-test-id="dashboard-customize-toggle"
            :class="[
              'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors',
              customizing
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-white/10 bg-canvas/55 text-surface hover:bg-hover'
            ]"
            @click="customizing = !customizing"
          >
            <icon-lucide-sliders class="size-4" />
            <span>{{ dashboard.customize.button }}</span>
          </button>

          <RouterLink
            to="/boards"
            data-test-id="dashboard-boards-link"
            class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-canvas/55 px-3 py-2 text-sm text-surface transition-colors hover:bg-hover"
          >
            <icon-lucide-layout-grid class="size-4" />
            <span>{{ dashboard.navLinks.boards }}</span>
          </RouterLink>

          <RouterLink
            to="/teams"
            data-test-id="dashboard-teams-link"
            class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-canvas/55 px-3 py-2 text-sm text-surface transition-colors hover:bg-hover"
          >
            <icon-lucide-users class="size-4" />
            <span>{{ dashboard.navLinks.teams }}</span>
          </RouterLink>

          <RouterLink
            v-if="showAccountLink"
            to="/account"
            data-test-id="dashboard-account-link"
            class="inline-flex items-center gap-3 rounded-full border border-white/10 bg-canvas/55 px-3 py-2 text-sm text-surface transition-colors hover:bg-hover"
          >
            <img
              v-if="auth.user?.image"
              :src="auth.user.image"
              :alt="`${authDisplayName} avatar`"
              data-test-id="dashboard-account-avatar-image"
              class="size-8 rounded-full object-cover"
            />
            <span
              v-else
              data-test-id="dashboard-account-avatar-fallback"
              class="flex size-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(103,149,255,0.85),rgba(78,95,172,0.85))] text-[11px] font-semibold text-white"
            >
              {{ authInitials }}
            </span>
            <span>{{ dashboard.navLinks.account }}</span>
          </RouterLink>
        </div>
      </header>

      <LoginBanner
        v-if="showLoginBanner"
        @login="startGoogleLogin"
      />

      <section
        v-if="customizing"
        data-test-id="dashboard-customize-panel"
        class="-order-1 flex flex-col gap-4 rounded-[28px] border border-accent/30 bg-panel/80 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-surface">{{ dashboard.customize.panelTitle }}</h2>
            <p class="text-sm text-muted">{{ dashboard.customize.panelHint }}</p>
            <p
              data-test-id="dashboard-customize-keyboard-hint"
              class="text-xs text-muted"
            >
              {{ dashboard.customize.keyboardHint }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              data-test-id="dashboard-customize-reset"
              class="cursor-pointer rounded-lg border border-white/10 bg-canvas/60 px-3 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="handleResetLayout"
            >
              {{ dashboard.customize.reset }}
            </button>
            <button
              type="button"
              data-test-id="dashboard-customize-done"
              class="cursor-pointer rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
              @click="customizing = false"
            >
              {{ dashboard.customize.done }}
            </button>
          </div>
        </div>

        <div
          data-test-id="dashboard-customize-announce"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          class="sr-only"
        >
          {{ dragAnnouncement }}
        </div>

        <ul
          data-test-id="dashboard-customize-list"
          class="flex flex-col gap-2"
        >
          <li
            v-for="(section, index) in layout"
            :key="section.id"
            :data-test-id="`dashboard-customize-row-${section.id}`"
            :draggable="true"
            :tabindex="0"
            :aria-label="formatTemplate(dashboard.customize.dragRowAria, { section: sectionLabel(section.id) })"
            :aria-grabbed="draggingSectionId === section.id || keyboardGrabbedId === section.id ? 'true' : 'false'"
            :aria-roledescription="dashboard.customize.dragRowAria.split(' ')[0]"
            role="listitem"
            :class="[
              'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-accent',
              draggingSectionId === section.id || keyboardGrabbedId === section.id ? 'opacity-60 border-accent bg-canvas/75' : 'border-white/8 bg-canvas/55',
              draggingSectionId && draggingSectionId !== section.id ? 'cursor-copy' : 'cursor-grab'
            ]"
            @dragstart="(event) => handleDragStart(section.id, event)"
            @dragover="handleDragOver"
            @drop="handleDrop(section.id)"
            @dragend="handleDragEnd"
            @keydown="(event) => handleRowKeydown(section.id, event)"
          >
            <div class="flex items-center gap-3">
              <span
                :data-test-id="`dashboard-customize-handle-${section.id}`"
                :aria-label="formatTemplate(dashboard.customize.dragHandleAria, { section: sectionLabel(section.id) })"
                role="img"
                class="text-muted"
              >
                <icon-lucide-grip-vertical class="size-4" />
              </span>
              <label class="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  :data-test-id="`dashboard-customize-toggle-${section.id}`"
                  :checked="section.enabled"
                  :aria-label="dashboard.customize.toggleAria"
                  class="size-4 cursor-pointer accent-accent"
                  @change="handleToggleSection(section.id)"
                />
                <span class="text-sm text-surface">{{ sectionLabel(section.id) }}</span>
              </label>
            </div>
            <div class="flex items-center gap-1">
              <button
                type="button"
                :data-test-id="`dashboard-customize-up-${section.id}`"
                :aria-label="dashboard.customize.moveUp"
                :disabled="index === 0"
                class="cursor-pointer rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-surface disabled:cursor-not-allowed disabled:opacity-40"
                @click="handleMoveSection(section.id, 'up')"
              >
                <icon-lucide-arrow-up class="size-3.5" />
              </button>
              <button
                type="button"
                :data-test-id="`dashboard-customize-down-${section.id}`"
                :aria-label="dashboard.customize.moveDown"
                :disabled="index === layout.length - 1"
                class="cursor-pointer rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-surface disabled:cursor-not-allowed disabled:opacity-40"
                @click="handleMoveSection(section.id, 'down')"
              >
                <icon-lucide-arrow-down class="size-3.5" />
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section
        v-if="isSectionEnabled('metrics')"
        data-test-id="dashboard-section-metrics"
        :style="{ order: indexOfSection('metrics') }"
        class="grid grid-cols-1 gap-4 md:grid-cols-4"
      >
        <div
          data-test-id="dashboard-metric-personal-boards"
          class="flex flex-col gap-1 rounded-2xl border border-white/8 bg-panel/80 p-4 shadow-lg"
        >
          <p class="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">{{ dashboard.metrics.personalBoards }}</p>
          <p class="text-2xl font-semibold text-surface">{{ personalBoardCount }}</p>
        </div>

        <div
          data-test-id="dashboard-metric-team-boards"
          class="flex flex-col gap-1 rounded-2xl border border-white/8 bg-panel/80 p-4 shadow-lg"
        >
          <p class="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">{{ dashboard.metrics.teamBoards }}</p>
          <p class="text-2xl font-semibold text-surface">{{ teamBoardCount }}</p>
        </div>

        <div
          data-test-id="dashboard-metric-teams"
          class="flex flex-col gap-1 rounded-2xl border border-white/8 bg-panel/80 p-4 shadow-lg"
        >
          <p class="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">{{ dashboard.metrics.teams }}</p>
          <p class="text-2xl font-semibold text-surface">{{ totalTeams }}</p>
        </div>

        <div
          data-test-id="dashboard-metric-unread"
          class="flex flex-col gap-1 rounded-2xl border border-white/8 bg-panel/80 p-4 shadow-lg"
        >
          <p class="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">{{ dashboard.metrics.unread }}</p>
          <p class="text-2xl font-semibold text-surface">{{ totalUnread }}</p>
        </div>
      </section>

      <section
        v-if="isSectionEnabled('quickActions')"
        data-test-id="dashboard-quick-actions"
        :style="{ order: indexOfSection('quickActions') }"
        class="flex flex-col gap-4 rounded-[28px] border border-white/8 bg-panel/80 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-surface">{{ dashboard.quickActions.heading }}</h2>
            <p class="text-sm text-muted">{{ dashboard.quickActions.subtitle }}</p>
          </div>
          <button
            type="button"
            data-test-id="dashboard-create-board"
            class="cursor-pointer rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="creating"
            @click="createQuickBoard"
          >
            <span v-if="creating">{{ dashboard.quickActions.creating }}</span>
            <span v-else>{{ dashboard.quickActions.newBoard }}</span>
          </button>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <RouterLink
            to="/boards"
            data-test-id="dashboard-link-boards"
            class="flex flex-col gap-1 rounded-xl border border-white/8 bg-canvas/55 p-4 text-sm text-surface transition-colors hover:bg-hover"
          >
            <icon-lucide-layout-grid class="size-5 text-accent" />
            <span class="font-medium">{{ dashboard.quickActions.allBoards }}</span>
            <span class="text-xs text-muted">{{ dashboard.quickActions.allBoardsHint }}</span>
          </RouterLink>

          <RouterLink
            to="/teams"
            data-test-id="dashboard-link-teams"
            class="flex flex-col gap-1 rounded-xl border border-white/8 bg-canvas/55 p-4 text-sm text-surface transition-colors hover:bg-hover"
          >
            <icon-lucide-users class="size-5 text-accent" />
            <span class="font-medium">{{ dashboard.quickActions.teams }}</span>
            <span class="text-xs text-muted">{{ dashboard.quickActions.teamsHint }}</span>
          </RouterLink>

          <RouterLink
            to="/notifications"
            data-test-id="dashboard-link-notifications"
            class="flex flex-col gap-1 rounded-xl border border-white/8 bg-canvas/55 p-4 text-sm text-surface transition-colors hover:bg-hover"
          >
            <icon-lucide-bell class="size-5 text-accent" />
            <span class="font-medium">{{ dashboard.quickActions.notifications }}</span>
            <span class="text-xs text-muted">{{ formatTemplate(dashboard.quickActions.notificationsHint, { count: totalUnread }) }}</span>
          </RouterLink>
        </div>
      </section>

      <section
        v-if="isSectionEnabled('pinned') && pinnedBoards.length > 0"
        data-test-id="dashboard-pinned-boards"
        :style="{ order: indexOfSection('pinned') }"
        class="flex flex-col gap-4 rounded-[28px] border border-white/8 bg-panel/80 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-surface">{{ dashboard.pinned.heading }}</h2>
            <p class="text-sm text-muted">{{ formatTemplate(dashboard.pinned.countLabel, { count: pinnedBoards.length }) }}</p>
          </div>
        </div>

        <ul
          data-test-id="dashboard-pinned-list"
          class="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          <li
            v-for="board in pinnedBoards"
            :key="board.id"
            :data-test-id="`dashboard-pinned-board-${board.id}`"
            class="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/8 bg-canvas/55 transition-colors hover:bg-hover"
            @click="openBoard(board)"
          >
            <button
              type="button"
              :data-test-id="`dashboard-pin-toggle-${board.id}`"
              :aria-label="dashboard.pinAria.toggle"
              class="absolute right-2 top-2 z-10 rounded-full bg-canvas/80 p-1 text-accent transition-colors hover:bg-canvas"
              @click="(event) => handleTogglePin(board.id, event)"
            >
              <icon-lucide-pin class="size-3.5" />
            </button>
            <div class="aspect-video w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_60%)]">
              <img
                v-if="previews[board.id]"
                :src="previews[board.id]"
                :alt="`${board.name} preview`"
                class="size-full object-cover"
              />
              <div
                v-else
                class="flex size-full items-center justify-center text-muted"
              >
                <icon-lucide-image class="size-8" />
              </div>
            </div>
            <div class="flex flex-col gap-1 p-3">
              <p class="line-clamp-1 text-sm font-medium text-surface">{{ board.name }}</p>
              <p class="flex items-center gap-1 text-[11px] text-muted">
                <icon-lucide-clock class="size-3" />
                {{ formatRelativeUpdate(board.updatedAt) }}
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section
        v-if="isSectionEnabled('recent')"
        data-test-id="dashboard-recent-boards"
        :style="{ order: indexOfSection('recent') }"
        class="flex flex-col gap-4 rounded-[28px] border border-white/8 bg-panel/80 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-surface">{{ dashboard.recent.heading }}</h2>
            <p class="text-sm text-muted">{{ dashboard.recent.subtitle }}</p>
          </div>
          <RouterLink
            to="/boards"
            data-test-id="dashboard-view-all-boards"
            class="text-sm text-accent hover:underline"
          >
            {{ dashboard.recent.viewAll }}
          </RouterLink>
        </div>

        <p
          v-if="loading"
          data-test-id="dashboard-recent-loading"
          class="text-sm text-muted"
        >
          {{ dashboard.recent.loading }}
        </p>
        <p
          v-else-if="recentBoards.length === 0"
          data-test-id="dashboard-recent-empty"
          class="text-sm text-muted"
        >
          {{ dashboard.recent.empty }}
        </p>
        <ul
          v-else
          data-test-id="dashboard-recent-list"
          class="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          <li
            v-for="board in recentBoards"
            :key="board.id"
            :data-test-id="`dashboard-recent-board-${board.id}`"
            class="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/8 bg-canvas/55 transition-colors hover:bg-hover"
            @click="openBoard(board)"
          >
            <button
              type="button"
              :data-test-id="`dashboard-recent-pin-${board.id}`"
              :aria-label="isPinned(board.id) ? dashboard.pinAria.unpin : dashboard.pinAria.pin"
              :class="[
                'absolute right-2 top-2 z-10 rounded-full p-1 transition-colors',
                isPinned(board.id)
                  ? 'bg-canvas/80 text-accent hover:bg-canvas'
                  : 'bg-canvas/40 text-muted opacity-0 hover:bg-canvas/70 hover:text-surface group-hover:opacity-100'
              ]"
              @click="(event) => handleTogglePin(board.id, event)"
            >
              <icon-lucide-pin class="size-3.5" />
            </button>
            <div class="aspect-video w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_60%)]">
              <img
                v-if="previews[board.id]"
                :src="previews[board.id]"
                :alt="`${board.name} preview`"
                class="size-full object-cover"
              />
              <div
                v-else
                class="flex size-full items-center justify-center text-muted"
              >
                <icon-lucide-image class="size-8" />
              </div>
            </div>
            <div class="flex flex-col gap-1 p-3">
              <p class="line-clamp-1 text-sm font-medium text-surface">{{ board.name }}</p>
              <p class="flex items-center gap-1 text-[11px] text-muted">
                <icon-lucide-clock class="size-3" />
                {{ formatRelativeUpdate(board.updatedAt) }}
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section
        v-if="isSectionEnabled('activity') && auth.isAuthenticated"
        data-test-id="dashboard-activity"
        :style="{ order: indexOfSection('activity') }"
        class="flex flex-col gap-4 rounded-[28px] border border-white/8 bg-panel/80 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-surface">{{ dashboard.activityFeed.heading }}</h2>
            <p class="text-sm text-muted">{{ dashboard.activityFeed.subtitle }}</p>
          </div>
          <RouterLink
            to="/notifications"
            data-test-id="dashboard-view-all-activity"
            class="text-sm text-accent hover:underline"
          >
            {{ dashboard.activityFeed.viewAll }}
          </RouterLink>
        </div>

        <p
          v-if="latestNotifications.length === 0"
          data-test-id="dashboard-activity-empty"
          class="text-sm text-muted"
        >
          {{ dashboard.activityFeed.empty }}
        </p>
        <ul
          v-else
          data-test-id="dashboard-activity-list"
          class="flex flex-col gap-2"
        >
          <li
            v-for="notification in latestNotifications"
            :key="notification.id"
            :data-test-id="`dashboard-activity-${notification.id}`"
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-canvas/55 p-3 transition-colors hover:bg-hover"
            @click="openNotification(notification.id)"
          >
            <div
              v-if="notification.readAt === null"
              class="mt-1.5 size-2 shrink-0 rounded-full bg-accent"
              aria-hidden="true"
            />
            <div
              v-else
              class="mt-1.5 size-2 shrink-0 rounded-full bg-muted/30"
              aria-hidden="true"
            />
            <div class="flex flex-1 flex-col gap-1">
              <p class="text-sm font-medium text-surface">{{ getNotificationTitle(notification, notificationsFormatT) }}</p>
              <p class="text-xs text-muted">{{ getNotificationBody(notification, notificationsFormatT) }}</p>
              <p class="text-[11px] text-muted">{{ formatNotificationTime(notification) }}</p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>
