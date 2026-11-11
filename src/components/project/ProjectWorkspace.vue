<script setup lang="ts">
import { useSourceControlMessages } from '@open-pencil/vue/i18n'

import { useSourceControl } from '@/app/integrations/git/use'
import { useProjectBaselines } from '@/app/live-pages/drift/sidecar/use'
import { useProjectRunner } from '@/app/projects/runner'
import type { Project } from '@/app/projects/schema'
import { openExternalLink } from '@/app/shell/ui'
import { canRunHostProcesses } from '@/app/tauri/capabilities'
import ProjectApplication from '@/components/project/ProjectApplication.vue'
import SourceControlPanel from '@/components/source-control/SourceControlPanel.vue'

/**
 * A project's screen: the repository it belongs to, the source control of that repository, and
 * the application it holds вЂ” started from here and shown in place. The panel answers for the
 * project it is given, so switching tabs switches repository.
 */
const { project } = defineProps<{ project: Project }>()

const source = useSourceControlMessages()
const control = useSourceControl(() => project.repository)
const baselines = useProjectBaselines(() => project.repository)
const {
  state: runState,
  output: runOutput,
  failure: runFailure,
  exitCode,
  address,
  start: startApplication,
  stop: stopApplication
} = useProjectRunner(() => project)

void control.refresh()

function openApplication(): void {
  if (address.value !== '') void openExternalLink(address.value)
}

async function openPullRequest(): Promise<void> {
  // The request carries the pictures its pages were compared against, so a reviewer compares the
  // pages against the same ones; a document with none, or a project that refused, answers first.
  await baselines.publish()
  // A branch that exists only on this machine is not a pull request yet: the GitHub CLI does not
  // publish one, and the comparison page has nothing to compare. The branch goes out first, and a
  // push git refused is reported by the panel instead of a page opened on top of it.
  if (!(await control.push())) return
  const created = await control.createPullRequest()
  const url = created ?? control.compareLink.value
  if (url !== null) void openExternalLink(url)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-canvas text-surface">
    <header class="flex shrink-0 flex-wrap items-start gap-3 border-b border-border px-6 py-4">
      <div class="min-w-0">
        <h1 class="truncate text-base font-semibold">{{ project.name }}</h1>
        <p class="mt-0.5 truncate text-2xs text-muted">{{ project.repository }}</p>
      </div>
    </header>

    <div
      class="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-5 lg:grid-cols-2 lg:overflow-hidden"
    >
      <section class="min-w-0 lg:overflow-y-auto">
        <h2 class="mb-3 text-xs font-medium text-muted">{{ source.title }}</h2>
        <SourceControlPanel
          :availability="control.availability.value"
          :status="control.status.value"
          :branches="control.branches.value"
          :failure="control.failure.value"
          :busy="control.busy.value"
          :commit-message="control.commitMessage.value"
          :diff="control.diff.value"
          :compare-link="control.compareLink.value"
          @update:commit-message="control.commitMessage.value = $event"
          @refresh="control.refresh()"
          @commit="control.commit()"
          @push="control.push()"
          @checkout="control.checkout($event)"
          @fetch="control.fetchBranches()"
          @pull="control.pull()"
          @stash="control.stash()"
          @create-branch="control.checkout($event, true)"
          @open-diff="control.showDiff($event)"
          @close-diff="control.closeDiff()"
          @pull-request="openPullRequest"
        />
      </section>

      <ProjectApplication
        :command="project.startCommand"
        :state="runState"
        :address="address"
        :output="runOutput"
        :failure="runFailure"
        :exit-code="exitCode"
        :available="canRunHostProcesses()"
        @start="startApplication"
        @stop="stopApplication"
        @open="openApplication"
      />
    </div>
  </div>
</template>
