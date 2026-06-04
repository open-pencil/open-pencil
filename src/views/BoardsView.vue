<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'

import { readBoardPreview } from '@/app/boards/preview'
import BoardCard from '@/components/BoardCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { createBoard, deleteBoard, listBoards, type Board } from '@/app/api/client'
import { toast } from '@/app/shell/ui'

useHead({ title: 'Boards' })

const router = useRouter()
const boards = ref<Board[]>([])
const boardName = ref('Untitled board')
const searchQuery = ref('')
const loading = ref(false)
const creating = ref(false)
const previews = ref<Record<string, string>>({})

const filteredBoards = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return boards.value
  return boards.value.filter((board) => board.name.toLowerCase().includes(query))
})

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

async function loadBoards() {
  loading.value = true
  try {
    boards.value = await listBoards()
    syncPreviewsSoon(boards.value)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load boards'
    toast.error(message)
    console.warn('[boards]', error)
  } finally {
    loading.value = false
  }
}

async function createAndOpenBoard() {
  creating.value = true
  try {
    const board = await createBoard(boardName.value.trim() || 'Untitled board')
    boards.value = [board, ...boards.value.filter((candidate) => candidate.id !== board.id)]
    syncPreviewsSoon(boards.value)
    boardName.value = 'Untitled board'
    await router.push({
      path: '/',
      query: {
        board: board.id,
        name: board.name
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create board'
    toast.error(message)
  } finally {
    creating.value = false
  }
}

function openBoard(board: Board) {
  void router.push({
    path: '/',
    query: {
      board: board.id,
      name: board.name
    }
  })
}

function openSettings(board: Board) {
  void router.push(`/board/${board.id}/settings`)
}

async function removeBoard(board: Board) {
  if (!window.confirm(`Delete "${board.name}"?`)) return
  try {
    await deleteBoard(board.id)
    boards.value = boards.value.filter((candidate) => candidate.id !== board.id)
    syncPreviewsSoon(boards.value)
    toast.info('Board deleted')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete board'
    toast.error(message)
  }
}

onMounted(() => {
  void loadBoards()
})
</script>

<template>
  <main
    data-test-id="boards-view"
    class="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(89,140,255,0.16),transparent_30%),linear-gradient(180deg,var(--color-canvas),#0d1017)] px-6 py-10"
  >
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <section class="flex flex-col gap-6 rounded-[28px] border border-white/8 bg-panel/80 p-6 shadow-2xl backdrop-blur-xl">
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div class="space-y-2">
            <p class="text-[11px] font-medium uppercase tracking-[0.24em] text-accent">
              Dashboard
            </p>
            <h1 class="text-3xl font-semibold text-surface">Your boards</h1>
            <p class="max-w-2xl text-sm text-muted">
              Create a board, open it in the editor, and manage invitation links without
              leaving Inkly.
            </p>
          </div>

          <div class="flex w-full max-w-md flex-col gap-2 md:items-end">
            <AppInput
              v-model="boardName"
              test-id="board-create-input"
              type="text"
              placeholder="Board name"
            />
            <button
              type="button"
              data-test-id="board-create-button"
              class="cursor-pointer rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="creating"
              @click="createAndOpenBoard"
            >
              {{ creating ? 'Creating…' : 'New board' }}
            </button>
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="space-y-1">
            <h2 class="text-sm font-medium text-surface">Recent boards</h2>
            <p class="text-xs text-muted">Search by board name or reopen a recently edited board.</p>
          </div>
          <div class="flex w-full max-w-lg items-center gap-2">
            <AppInput
              v-model="searchQuery"
              test-id="board-search-input"
              type="search"
              placeholder="Search boards"
            />
            <button
              type="button"
              class="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="loadBoards"
            >
              Refresh
            </button>
          </div>
        </div>

        <div
          v-if="loading"
          class="rounded-2xl border border-border bg-panel/70 p-6 text-sm text-muted"
        >
          Loading boards…
        </div>

        <div
          v-else-if="boards.length === 0"
          class="rounded-[24px] border border-dashed border-border bg-panel/60 p-10 text-center"
        >
          <p class="text-lg font-medium text-surface">No boards yet</p>
          <p class="mt-2 text-sm text-muted">
            Create your first board to start the invite and settings flows.
          </p>
        </div>

        <div
          v-else-if="filteredBoards.length === 0"
          data-test-id="board-search-empty"
          class="rounded-[24px] border border-dashed border-border bg-panel/60 p-10 text-center"
        >
          <p class="text-lg font-medium text-surface">No matching boards</p>
          <p class="mt-2 text-sm text-muted">Try a different name or clear the search box.</p>
        </div>

        <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <BoardCard
            v-for="board in filteredBoards"
            :key="board.id"
            :board="board"
            :preview-url="previews[board.id] ?? null"
            @open="openBoard"
            @settings="openSettings"
            @delete="removeBoard"
          />
        </div>
      </section>
    </div>
  </main>
</template>
