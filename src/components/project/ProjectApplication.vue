<script setup lang="ts">
import { computed, ref } from 'vue'

import { useProjectMessages } from '@open-pencil/vue/i18n'

import type { ProjectRunState } from '@/app/projects/runner'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

/**
 * The application a project holds: the command that starts it, how the run is going, what it
 * printed, and the frame that shows it. It renders state and reports intent; `useProjectRunner`
 * owns the process.
 */
const {
  command,
  state,
  address,
  output,
  failure,
  exitCode = null,
  available = true
} = defineProps<{
  command: string
  state: ProjectRunState
  address: string
  output: readonly string[]
  failure: string | null
  exitCode?: number | null
  /** Whether this build may start host programs at all, as a package may switch them off. */
  available?: boolean
}>()

const emit = defineEmits<{ start: []; stop: []; open: [] }>()

const labels = useProjectMessages()

/** Bumping this reloads the frame without touching the run itself. */
const reloads = ref(0)

const running = computed(() => state === 'starting' || state === 'running')
const canStart = computed(() => available && command.trim() !== '' && !running.value)
/** The frame shows a running application that has named its address. */
const previewing = computed(() => state === 'running' && address !== '')

const status = computed(() => {
  switch (state) {
    case 'starting':
      return labels.value.runStarting
    case 'running':
      return labels.value.runRunning
    case 'stopped':
      return exitCode === null
        ? labels.value.runStopped
        : labels.value.runExited({ code: exitCode })
    case 'failed':
      return labels.value.runFailed
    default:
      return ''
  }
})

const placeholder = computed(() =>
  running.value ? labels.value.runStarting : labels.value.previewEmpty
)
</script>

<template>
  <section class="flex min-h-0 min-w-0 flex-col">
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="text-xs font-medium text-muted">{{ labels.application }}</h2>
      <div class="ms-auto flex items-center gap-1">
        <AppButton
          v-if="running"
          variant="outline"
          size="xs"
          data-test-id="project-run-stop"
          @click="emit('stop')"
        >
          {{ labels.runStop }}
        </AppButton>
        <AppButton
          v-else
          variant="solid"
          color="primary"
          size="xs"
          :disabled="!canStart"
          data-test-id="project-run-start"
          @click="emit('start')"
        >
          {{ labels.runStart }}
        </AppButton>
        <IconButton v-if="address" class="size-6" :label="labels.runOpen" @click="emit('open')">
          <icon-lucide-external-link class="size-3" />
        </IconButton>
        <IconButton
          class="size-6"
          :label="labels.previewReload"
          :disabled="!previewing"
          @click="reloads += 1"
        >
          <icon-lucide-refresh-cw class="size-3" />
        </IconButton>
      </div>
    </div>

    <p v-if="command" class="mt-2 truncate text-2xs text-muted">
      {{ labels.startCommand({ command }) }}
    </p>
    <p v-else class="mt-2 text-2xs text-muted">{{ labels.runNoCommand }}</p>

    <p v-if="status" class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs">
      <span class="font-medium text-surface">{{ status }}</span>
      <span v-if="address" class="truncate text-muted">{{ address }}</span>
    </p>

    <AppAlert
      v-if="failure"
      tone="error"
      class="mt-2"
      :heading="labels.runFailed"
      :description="failure"
    />

    <div
      v-if="previewing"
      class="mt-3 min-h-64 flex-1 overflow-hidden rounded-lg border border-border bg-white"
    >
      <iframe
        :key="`${address}#${reloads}`"
        :src="address"
        class="size-full"
        :aria-label="labels.preview"
      />
    </div>
    <p
      v-else
      class="mt-3 rounded-lg border border-dashed border-border px-4 py-6 text-center text-2xs text-muted"
    >
      {{ placeholder }}
    </p>

    <template v-if="output.length > 0">
      <h3 class="mt-3 text-2xs font-medium text-muted">{{ labels.runOutput }}</h3>
      <pre
        class="mt-1 max-h-40 shrink-0 overflow-auto rounded-lg border border-border bg-panel-field p-3 text-2xs leading-relaxed whitespace-pre-wrap text-surface"
        >{{ output.join('\n') }}</pre>
    </template>
  </section>
</template>
