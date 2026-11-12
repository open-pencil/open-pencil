<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  useCommonMessages,
  usePanelMessages,
  useSourceControlMessages
} from '@open-pencil/vue/i18n'

import type { GitFailure } from '@/app/integrations/git/client'
import type {
  GitAvailability,
  GitBranch,
  GitStatus,
  GitStatusEntry
} from '@/app/integrations/git/schema'
import type { GitDiff } from '@/app/integrations/git/use'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

import BranchPicker from './BranchPicker.vue'

/**
 * The source-control surface of one project: the branch it is on, what changed in it, the patch
 * of a change, and the actions the panel performs. It renders state and reports intent;
 * `useSourceControl` owns both.
 */
const { availability, status, branches, failure, busy, commitMessage, diff, compareLink } =
  defineProps<{
    availability: GitAvailability | null
    status: GitStatus | null
    branches: GitBranch[]
    failure: GitFailure | null
    busy: boolean
    commitMessage: string
    /** The patch being read, when one is open in place of the file list. */
    diff: GitDiff | null
    /** The page a pull request opens from, or null while the remote or the branch is unknown. */
    compareLink: string | null
  }>()

const emit = defineEmits<{
  'update:commitMessage': [value: string]
  refresh: []
  commit: []
  push: []
  checkout: [name: string]
  fetch: []
  pull: []
  stash: []
  createBranch: [name: string]
  openDiff: [entry: GitStatusEntry]
  closeDiff: []
  pullRequest: []
}>()

const labels = useSourceControlMessages()
const common = useCommonMessages()
/** The reading state of a patch says it is loading, in words a screen reader can read out. */
const panels = usePanelMessages()

/** The new branch being named; the panel owns the field, the workflow creates it. */
const naming = ref(false)
const branchName = ref('')

const branch = computed(() => status?.branch ?? null)
const changedCount = computed(() => status?.entries.length ?? 0)
const behind = computed(() => branch.value?.behind ?? 0)
/** Whether there is an upstream to pull from and push to, which a read branch answers. */
const hasUpstream = computed(() => (branch.value?.upstream ?? null) !== null)
const canCommit = computed(() => !busy && changedCount.value > 0 && commitMessage.trim() !== '')
/** Untracked and ignored paths carry no status pair, so the list shows only modified kinds. */
const showsStatusPair = (kind: string) =>
  kind === 'changed' || kind === 'renamed' || kind === 'unmerged'

function createBranch(): void {
  const name = branchName.value.trim()
  if (name === '') return
  emit('createBranch', name)
  branchName.value = ''
  naming.value = false
}
</script>

<template>
  <div class="flex min-h-0 flex-col gap-3 text-xs">
    <p v-if="availability === null" class="text-2xs text-muted">{{ labels.unavailable }}</p>

    <template v-else>
      <div class="flex flex-wrap items-center gap-1.5 text-2xs text-muted">
        <span v-if="branch?.head" class="rounded bg-accent/10 px-1.5 py-px text-primary">
          {{ branch.head }}
        </span>
        <span v-if="hasUpstream && branch">
          {{ labels.aheadBehind({ ahead: branch.ahead, behind: branch.behind }) }}
        </span>
        <span v-if="changedCount > 0">{{ labels.changes({ count: changedCount }) }}</span>
        <span v-else>{{ labels.clean }}</span>

        <div class="ms-auto flex items-center gap-0.5">
          <IconButton class="size-6" :label="labels.fetch" :disabled="busy" @click="emit('fetch')">
            <icon-lucide-cloud-download class="size-3" />
          </IconButton>
          <IconButton
            v-if="behind > 0"
            class="size-6"
            :label="labels.pull"
            :disabled="busy"
            @click="emit('pull')"
          >
            <icon-lucide-arrow-down-to-line class="size-3" />
          </IconButton>
          <IconButton
            v-if="changedCount > 0"
            class="size-6"
            :label="labels.stash"
            :disabled="busy"
            @click="emit('stash')"
          >
            <icon-lucide-archive class="size-3" />
          </IconButton>
          <IconButton
            class="size-6"
            :label="labels.newBranch"
            :disabled="busy"
            @click="naming = !naming"
          >
            <icon-lucide-git-branch-plus class="size-3" />
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

      <form v-if="naming" class="flex gap-1.5" @submit.prevent="createBranch">
        <AppInput
          v-model="branchName"
          size="xs"
          tone="panel"
          :placeholder="labels.branchName"
          :aria-label="labels.branchName"
        />
        <AppButton
          type="submit"
          variant="solid"
          color="primary"
          size="xs"
          :disabled="!branchName.trim() || busy"
        >
          {{ labels.create }}
        </AppButton>
      </form>

      <div v-if="diff" class="flex min-h-0 flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <IconButton class="size-6" :label="labels.backToFiles" @click="emit('closeDiff')">
            <icon-lucide-arrow-left data-direction="reading" class="size-3" />
          </IconButton>
          <span class="truncate text-2xs text-surface">{{ diff.path }}</span>
        </div>
        <p v-if="diff.reading" class="text-2xs text-muted">{{ panels.loading }}</p>
        <p v-else-if="diff.kind === 'untracked'" class="text-2xs text-muted">
          {{ labels.untrackedNote }}
        </p>
        <pre
          v-else
          class="max-h-80 overflow-auto rounded border border-border bg-panel-field p-2 text-2xs leading-relaxed whitespace-pre text-surface"
          >{{ diff.patch }}</pre>
      </div>

      <ul v-else-if="changedCount > 0" class="space-y-0.5">
        <li
          v-for="entry in status?.entries ?? []"
          :key="`${entry.path}:${entry.originalPath ?? ''}`"
        >
          <button
            type="button"
            class="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-start hover:bg-hover focus-visible:outline-2 focus-visible:outline-panel-focus"
            @click="emit('openDiff', entry)"
          >
            <span class="w-3 shrink-0 text-2xs text-muted">
              {{ showsStatusPair(entry.kind) ? entry.index + entry.worktree : '' }}
            </span>
            <span class="truncate text-2xs text-surface">{{ entry.path }}</span>
          </button>
        </li>
      </ul>

      <BranchPicker :branches="branches" :disabled="busy" @checkout="emit('checkout', $event)" />

      <form class="flex flex-col gap-1.5" @submit.prevent="emit('commit')">
        <label class="text-2xs text-muted" for="source-control-message">
          {{ labels.commitMessage }}
        </label>
        <AppInput
          id="source-control-message"
          size="xs"
          tone="panel"
          :model-value="commitMessage"
          :placeholder="labels.commitPlaceholder"
          :disabled="busy"
          @update:model-value="emit('update:commitMessage', String($event))"
        />
        <div class="flex gap-1.5">
          <AppButton type="submit" variant="solid" color="primary" size="xs" :disabled="!canCommit">
            {{ labels.commit }}
          </AppButton>
          <AppButton variant="outline" size="xs" :disabled="busy" @click="emit('push')">
            {{ labels.push }}
          </AppButton>
        </div>
      </form>

      <AppButton
        v-if="compareLink"
        variant="outline"
        size="xs"
        :disabled="busy"
        data-test-id="source-control-pull-request"
        @click="emit('pullRequest')"
      >
        <icon-lucide-git-pull-request class="me-1 size-3" />
        {{ labels.createPullRequest }}
      </AppButton>

      <AppAlert
        v-if="failure"
        tone="error"
        :heading="labels.gitFailed"
        :description="failure.summary"
      />
    </template>
  </div>
</template>
