<script setup lang="ts">
import { useStore } from '@nanostores/vue'
import { computed } from 'vue'

import { locale, useLivePageMessages } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import { baselineMoment } from '@/app/live-pages/drift/format'
import { DRIFT_SIDECAR_PATH } from '@/app/live-pages/drift/sidecar/model'
import { usePageDriftSidecar } from '@/app/live-pages/drift/sidecar/use'
import { usePageDrift } from '@/app/live-pages/drift/use'
import { useLivePagesSource } from '@/app/live-pages/open'
import { readLivePage } from '@/app/live-pages/schema'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

/**
 * The baseline of the page the selected frame shows: the picture kept for it, how the page stands
 * to it now, the buttons that keep one and compare against it, and the copy the project holds so
 * the pictures survive the document's own format.
 */
const store = useEditorStore()
const messages = useLivePageMessages()
const activeLocale = useStore(locale)
const { busy, failure, count, baselineOf, stateOf, keep, compare } = usePageDrift()
const source = useLivePagesSource()
const {
  busy: sidecarBusy,
  outcome: sidecarOutcome,
  save: writeBaselines,
  load: readBaselines
} = usePageDriftSidecar({ repository: () => source.project.value?.repository ?? null })

/** The repository the open document is saved in, which is where its baselines can be kept. */
const repository = computed(() => source.project.value?.repository ?? null)

/** The selected frame, once it shows a page: a plain frame has no page to compare. */
const node = computed(() => {
  void store.state.sceneVersion
  const [id] = store.state.selectedIds
  const selected = id ? store.graph.getNode(id) : undefined
  return selected && readLivePage(selected) ? selected : null
})

const baseline = computed(() => (node.value ? baselineOf(node.value.id) : null))
const state = computed(() => (node.value ? stateOf(node.value.id) : null))

const stateText = computed(() => {
  if (state.value === 'changed') return messages.value.baselineChanged
  if (state.value === 'same') return messages.value.baselineSame
  // A baseline kept earlier in another session is a page nothing has compared yet.
  if (baseline.value) return messages.value.baselineKept
  return messages.value.baselineMissing
})

const taken = computed(() => {
  const reference = baseline.value
  if (!reference) return ''
  const moment = baselineMoment(reference.capturedAt, activeLocale.value)
  return moment === '' ? '' : messages.value.baselineTaken({ date: moment })
})

const failureText = computed(() => {
  if (failure.value === 'not-drawn') return messages.value.baselineNotDrawn
  if (failure.value === 'not-saved') return messages.value.baselineNotSaved
  return ''
})

/** What the last move of the baselines to or from the project did, in the panel's words. */
const sidecarText = computed(() => {
  const outcome = sidecarOutcome.value
  if (outcome === null) return ''
  if (outcome.status === 'written') return messages.value.sidecarSaved({ path: DRIFT_SIDECAR_PATH })
  if (outcome.status === 'restored') return messages.value.sidecarRestored
  if (outcome.status === 'unchanged') return messages.value.sidecarUnchanged
  if (outcome.status === 'empty') return messages.value.sidecarEmpty
  if (outcome.status === 'missing') return messages.value.sidecarMissing
  if (outcome.status === 'other-document') return messages.value.sidecarOtherDocument
  return messages.value.sidecarUnavailable
})

async function keepBaseline(): Promise<void> {
  if (node.value) await keep(node.value.id)
}

async function comparePage(): Promise<void> {
  if (node.value) await compare(node.value.id)
}

async function compareEveryPage(): Promise<void> {
  await compare()
}
</script>

<template>
  <PanelSection v-if="node" :label="messages.baselines">
    <div class="flex flex-wrap items-center gap-1.5">
      <AppButton
        size="sm"
        variant="outline"
        :disabled="busy"
        data-test-id="live-page-baseline-keep"
        @click="keepBaseline"
      >
        {{ messages.keepBaseline }}
      </AppButton>
      <AppButton
        size="sm"
        variant="outline"
        :disabled="busy"
        data-test-id="live-page-baseline-compare"
        @click="comparePage"
      >
        {{ messages.compareBaseline }}
      </AppButton>
      <AppButton
        v-if="count > 1"
        size="sm"
        variant="outline"
        :disabled="busy"
        data-test-id="live-page-baseline-compare-all"
        @click="compareEveryPage"
      >
        {{ messages.compareAll }}
      </AppButton>
    </div>

    <p class="mt-1.5 text-2xs leading-snug text-muted" data-test-id="live-page-baseline-state">
      {{ stateText }}
    </p>
    <p
      v-if="taken"
      class="mt-0.5 text-2xs leading-snug text-muted"
      data-test-id="live-page-baseline-taken"
    >
      {{ taken }}
    </p>

    <AppAlert
      v-if="failureText"
      class="mt-1.5"
      :tone="failure === 'not-saved' ? 'error' : 'warning'"
      :heading="failureText"
    />
    <p v-else class="mt-1.5 text-2xs leading-snug text-muted">{{ messages.baselineHint }}</p>

    <div v-if="repository" class="mt-1.5 flex flex-wrap items-center gap-1.5">
      <AppButton
        size="sm"
        variant="outline"
        :disabled="sidecarBusy"
        data-test-id="live-page-baselines-write"
        @click="writeBaselines"
      >
        {{ messages.sidecarSave }}
      </AppButton>
      <AppButton
        size="sm"
        variant="outline"
        :disabled="sidecarBusy"
        data-test-id="live-page-baselines-read"
        @click="readBaselines"
      >
        {{ messages.sidecarLoad }}
      </AppButton>
    </div>
    <p
      v-if="sidecarText"
      class="mt-1 text-2xs leading-snug text-muted"
      data-test-id="live-page-baselines-project"
    >
      {{ sidecarText }}
    </p>
  </PanelSection>
</template>
