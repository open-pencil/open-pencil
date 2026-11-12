<script setup lang="ts">
import { computed, ref } from 'vue'

import { useProjectMessages } from '@open-pencil/vue/i18n'

import type { Project } from '@/app/projects/schema'
import type { ProjectStatus } from '@/app/projects/status'
import type { ProjectAddFailure } from '@/app/projects/use'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

/**
 * The projects Home lists: each repository it knows with its branch and changes, the action
 * that adds another, and the ones that rename or remove a project. It renders state and reports
 * intent; `useProjectImport` and `useProjectStatuses` own picking and reading.
 */
const {
  projects,
  statuses = {},
  busy = false,
  failure = null
} = defineProps<{
  projects: readonly Project[]
  /** What git answered for each project, by id; a project git cannot read has no entry. */
  statuses?: Record<string, ProjectStatus>
  busy?: boolean
  failure?: ProjectAddFailure | null
}>()

const emit = defineEmits<{
  add: []
  open: [project: Project]
  remove: [project: Project]
  rename: [id: string, name: string]
}>()

const labels = useProjectMessages()

/** Each project with the status git answered for it, so the template reads one row at a time. */
const rows = computed(() =>
  projects.map((project) => ({ project, status: statuses[project.id] ?? null }))
)

/** Why the last add produced nothing, in the section's own words. */
const failureDescription = computed(() => {
  if (failure === null) return ''
  if (failure.kind === 'failed') return failure.reason
  return failure.kind === 'notRepository' ? labels.value.notRepository : labels.value.unavailable
})

/** The row being renamed and the name typed so far; the section owns the field. */
const renaming = ref<string | null>(null)
const draft = ref('')

function startRename(project: Project): void {
  renaming.value = project.id
  draft.value = project.name
}

/** An empty name keeps the old one, the same way the stored record refuses it. */
function commitRename(): void {
  const id = renaming.value
  const name = draft.value.trim()
  renaming.value = null
  if (id !== null && name !== '') emit('rename', id, name)
}

function cancelRename(): void {
  renaming.value = null
}
</script>

<template>
  <section>
    <div class="mb-3 flex items-start gap-3">
      <div class="min-w-0">
        <h2 class="text-base font-semibold">{{ labels.title }}</h2>
        <p class="mt-0.5 text-pretty text-xs text-muted">{{ labels.description }}</p>
      </div>
      <AppButton
        variant="outline"
        class="ms-auto shrink-0"
        :loading="busy"
        data-test-id="home-add-project"
        @click="emit('add')"
      >
        <template #leading>
          <icon-lucide-plus class="size-3.5" />
        </template>
        {{ labels.add }}
      </AppButton>
    </div>

    <AppAlert
      v-if="failure"
      tone="error"
      class="mb-3"
      :heading="labels.addFailed"
      :description="failureDescription"
    />

    <ul v-if="rows.length" class="overflow-hidden rounded-lg border border-border">
      <li
        v-for="row in rows"
        :key="row.project.id"
        class="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
      >
        <icon-lucide-folder-git-2 class="size-4 shrink-0 text-muted" aria-hidden="true" />

        <form
          v-if="renaming === row.project.id"
          class="flex min-w-0 flex-1 items-center gap-1.5"
          @submit.prevent="commitRename"
        >
          <AppInput
            v-model="draft"
            size="xs"
            tone="panel"
            autofocus
            :aria-label="labels.rename({ name: row.project.name })"
            :data-test-id="`project-name-${row.project.id}`"
            @keydown.esc="cancelRename"
          />
          <IconButton
            type="submit"
            class="size-7 shrink-0"
            :label="labels.renameSave"
            :disabled="!draft.trim()"
            :data-test-id="`project-rename-save-${row.project.id}`"
          >
            <icon-lucide-check class="size-3.5" />
          </IconButton>
          <IconButton
            class="size-7 shrink-0"
            :label="labels.renameCancel"
            :data-test-id="`project-rename-cancel-${row.project.id}`"
            @click="cancelRename"
          >
            <icon-lucide-x class="size-3.5" />
          </IconButton>
        </form>

        <template v-else>
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 rounded text-start focus-visible:outline-2 focus-visible:outline-panel-focus"
            @click="emit('open', row.project)"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-medium text-surface">
                {{ row.project.name }}
              </span>
              <span class="block truncate text-2xs text-muted">{{ row.project.repository }}</span>
            </span>
          </button>

          <span v-if="row.status" class="flex shrink-0 items-center gap-1.5">
            <span
              v-if="row.status.branch"
              class="flex items-center gap-1 rounded bg-accent/10 px-1.5 py-px text-4xs text-primary"
            >
              <icon-lucide-git-branch class="size-3" aria-hidden="true" />
              <span class="max-w-32 truncate">{{ row.status.branch }}</span>
            </span>
            <span v-if="row.status.changed > 0" class="text-4xs text-muted">
              {{ labels.changes({ count: row.status.changed }) }}
            </span>
          </span>

          <IconButton
            class="size-7 shrink-0"
            :label="labels.rename({ name: row.project.name })"
            :data-test-id="`project-rename-${row.project.id}`"
            @click="startRename(row.project)"
          >
            <icon-lucide-pencil class="size-3.5" />
          </IconButton>
          <IconButton
            class="size-7 shrink-0"
            :label="labels.remove({ name: row.project.name })"
            :data-test-id="`project-remove-${row.project.id}`"
            @click="emit('remove', row.project)"
          >
            <icon-lucide-trash-2 class="size-3.5" />
          </IconButton>
        </template>
      </li>
    </ul>

    <div v-else class="rounded-lg border border-dashed border-border">
      <AppPlaceholder
        size="compact"
        :fill="false"
        :label="labels.empty"
        :description="labels.emptyDescription"
      >
        <template #icon>
          <icon-lucide-folder-git-2 class="size-4" />
        </template>
      </AppPlaceholder>
    </div>
  </section>
</template>
