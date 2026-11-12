<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'

import { useCommonMessages, useSourceControlMessages } from '@open-pencil/vue/i18n'

import { useDateFormat } from '@/app/i18n/date'
import type { GitFailure } from '@/app/integrations/git/client'
import type {
  GitBranch,
  GitBranchState,
  GitCommitSummary,
  GitFileState
} from '@/app/integrations/git/schema'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

import BranchPicker from './BranchPicker.vue'

/**
 * Version control for the open document: the branch its repository is on, how the file itself
 * stands against the last commit, and the actions that touch that file alone. It renders state
 * and reports intent; `useDocumentGit` owns the repository.
 */
const {
  path,
  branch,
  state,
  branches,
  others,
  history,
  historyLoaded = false,
  busy,
  failure,
  commitMessage,
  versioned,
  canCommit
} = defineProps<{
  /** The file the document saves to; null while it has never been written. */
  path: string | null
  branch: GitBranchState | null
  state: GitFileState | null
  branches: GitBranch[]
  /** Other files the repository reports as changed. */
  others: number
  history: GitCommitSummary[]
  historyLoaded?: boolean
  busy: boolean
  failure: GitFailure | null
  commitMessage: string
  /** Whether git can see the document's file at all. */
  versioned: boolean
  canCommit: boolean
}>()

const emit = defineEmits<{
  'update:commitMessage': [value: string]
  refresh: []
  commit: []
  sync: []
  switch: [name: string]
  history: []
  restore: [commit: string]
}>()

const labels = useSourceControlMessages()
const common = useCommonMessages()
const dates = useDateFormat()

/** What git says about the file, in the panel's own words. */
const stateLabel = computed(() => {
  if (state === null) return ''
  const words: Record<GitFileState, string> = {
    clean: labels.value.fileClean,
    modified: labels.value.fileModified,
    added: labels.value.fileAdded,
    untracked: labels.value.fileUntracked,
    deleted: labels.value.fileDeleted,
    renamed: labels.value.fileRenamed
  }
  return words[state]
})

/** The commit a restore would go back to, set while the dialog asks for confirmation. */
const restoring = shallowRef<GitCommitSummary | null>(null)
const asking = ref(false)
// Cleared once the dialog closes, so the next one opens on its own commit instead of showing the
// hash of the last one for a moment.
watch(asking, (open) => {
  if (!open) restoring.value = null
})

function askRestore(commit: GitCommitSummary): void {
  restoring.value = commit
  asking.value = true
}

function confirmRestore(): void {
  const commit = restoring.value
  if (commit) emit('restore', commit.hash)
}

/** A commit's hash as a person reads it; the list shows the short form. */
function shortHash(hash: string): string {
  return hash.slice(0, 7)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 text-xs">
    <p v-if="!path" class="text-2xs text-muted">{{ labels.saveFirst }}</p>
    <p v-else-if="!versioned" class="text-2xs text-muted">{{ labels.notVersioned }}</p>

    <template v-else>
      <div class="flex flex-wrap items-center gap-1.5 text-2xs text-muted">
        <span v-if="branch?.head" class="rounded bg-accent/10 px-1.5 py-px text-primary">
          {{ branch.head }}
        </span>
        <span v-if="state" class="rounded bg-panel-field px-1.5 py-px text-surface">
          {{ stateLabel }}
        </span>
        <span v-if="others > 0">{{ labels.otherChanges({ count: others }) }}</span>

        <div class="ms-auto flex items-center gap-0.5">
          <IconButton class="size-6" :label="labels.pull" :disabled="busy" @click="emit('sync')">
            <icon-lucide-cloud-download class="size-3" />
          </IconButton>
          <IconButton
            class="size-6"
            :label="common.refresh"
            :disabled="busy"
            @click="emit('refresh')"
          >
            <icon-lucide-refresh-cw class="size-3" />
          </IconButton>
        </div>
      </div>

      <form class="flex flex-col gap-1.5" @submit.prevent="emit('commit')">
        <label class="text-2xs text-muted" for="document-git-message">
          {{ labels.commitMessage }}
        </label>
        <AppInput
          id="document-git-message"
          size="xs"
          tone="panel"
          :model-value="commitMessage"
          :placeholder="labels.commitPlaceholder"
          :disabled="busy"
          @update:model-value="emit('update:commitMessage', String($event))"
        />
        <AppButton
          type="submit"
          variant="solid"
          color="primary"
          size="xs"
          :disabled="!canCommit"
          data-test-id="document-git-commit"
        >
          {{ labels.commitFile }}
        </AppButton>
      </form>

      <div class="flex flex-col gap-1.5">
        <h3 class="text-2xs text-muted">{{ labels.branches }}</h3>
        <BranchPicker :branches="branches" :disabled="busy" @checkout="emit('switch', $event)" />
      </div>

      <div class="flex min-h-0 flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <h3 class="text-2xs text-muted">{{ labels.history }}</h3>
          <IconButton
            class="ms-auto size-6"
            :label="labels.historyRefresh"
            :disabled="busy"
            @click="emit('history')"
          >
            <icon-lucide-history class="size-3" />
          </IconButton>
        </div>

        <p v-if="historyLoaded && history.length === 0" class="text-2xs text-muted">
          {{ labels.historyEmpty }}
        </p>
        <ul v-else class="space-y-1">
          <li
            v-for="commit in history"
            :key="commit.hash"
            class="flex items-start gap-1.5 border-b border-border pb-1 last:border-b-0"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-2xs text-surface">{{ commit.subject }}</p>
              <p class="truncate text-3xs text-muted">
                {{ shortHash(commit.hash) }} · {{ commit.author }} ·
                {{ dates.format(commit.date, 'dateTime') }}
              </p>
            </div>
            <AppButton
              size="xs"
              variant="ghost"
              :disabled="busy"
              data-test-id="document-git-restore"
              @click="askRestore(commit)"
            >
              {{ labels.restoreVersion({ commit: shortHash(commit.hash) }) }}
            </AppButton>
          </li>
        </ul>
      </div>
    </template>

    <AppAlert
      v-if="failure"
      tone="error"
      :heading="labels.gitFailed"
      :description="failure.summary"
    />

    <AppConfirmationDialog
      v-model:open="asking"
      :heading="labels.restoreHeading({ commit: shortHash(restoring?.hash ?? '') })"
      :description="labels.restoreDescription"
      :cancel-label="common.cancel"
      :confirm-label="labels.restoreConfirm"
      tone="warning"
      @confirm="confirmRestore"
    />
  </div>
</template>
