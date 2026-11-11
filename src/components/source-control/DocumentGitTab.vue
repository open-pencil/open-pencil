<script setup lang="ts">
import { watch } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import { useDocumentGit } from '@/app/integrations/git/document'

import DocumentGitPanel from './DocumentGitPanel.vue'

/**
 * The Git tab of one document: `useDocumentGit` finds the repository the file saves into and
 * reads it; the panel shows the result and reports what to do. The tab is mounted with the
 * panel's other tabs, so it asks git only once it is shown.
 */
const { active = false } = defineProps<{ active?: boolean }>()

const store = useEditorStore()
const {
  path,
  branch,
  state,
  branches,
  others,
  history,
  historyLoaded,
  busy,
  failure,
  commitMessage,
  versioned,
  canCommit,
  refresh,
  commit,
  sync,
  switchTo,
  loadHistory,
  restore
} = useDocumentGit(store)

function setCommitMessage(value: string): void {
  commitMessage.value = value
}

// Saving a document to a new place moves it to another repository, and the tab follows the name.
// One read fills the whole tab: `refresh` reads the file's versions as well, and asked for them
// apart it would do so before it knew which repository the file belongs to.
watch(
  () => [active, store.state.documentName] as const,
  ([shown]) => {
    if (!shown) return
    void refresh()
  },
  { immediate: true }
)
</script>

<template>
  <DocumentGitPanel
    :path="path"
    :branch="branch"
    :state="state"
    :branches="branches"
    :others="others"
    :history="history"
    :history-loaded="historyLoaded"
    :busy="busy"
    :failure="failure"
    :commit-message="commitMessage"
    :versioned="versioned"
    :can-commit="canCommit"
    @update:commit-message="setCommitMessage"
    @refresh="refresh"
    @commit="commit"
    @sync="sync"
    @switch="switchTo"
    @history="loadHistory"
    @restore="restore"
  />
</template>
