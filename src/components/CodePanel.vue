<script setup lang="ts">
import { useClipboard, useDebounceFn } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, defineAsyncComponent, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import { JSX_REFERENCE } from '@open-pencil/design-jsx'
import { useI18n, useSceneComputed } from '@open-pencil/vue'

import {
  commitDOMCodeSession,
  createDOMCodeSession,
  previewDOMCode,
  resetDOMCodePreview,
  type DOMCodeSession
} from '@/app/code/dom-preview'
import { generatedCodeFor, type GeneratedCode } from '@/app/code/generated'
import { useCodeLayers } from '@/app/code/layers/use'
import {
  commitDesignJSXSession,
  createDesignJSXEditSession,
  previewDesignJSX,
  resetDesignJSXPreview,
  type DesignJSXEditSession,
  type DesignJSXLayerLine
} from '@/app/code/live-preview'
import { starterSourceFor, type CodeSource } from '@/app/code/templates'
import { useEditorStore } from '@/app/editor/active-store'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import statusTheme from '@/theme/feedback/status'

const CodeEditor = defineAsyncComponent(() => import('@/components/code-editor/CodeEditor.vue'))

const { active = true } = defineProps<{ active?: boolean }>()
const store = useEditorStore()
const editorActive = computed(() => active)
const { code, common } = useI18n()
const { copy, copied } = useClipboard({ copiedDuring: 2000 })
const { copy: copyReference, copied: copiedReference } = useClipboard({ copiedDuring: 2000 })
const source = ref<CodeSource>('design-jsx')
const draft = ref('')
const baseline = ref('')
const status = ref<'idle' | 'updating' | 'updated' | 'error'>('idle')
const error = ref('')
const designSession = shallowRef<DesignJSXEditSession | null>(null)
let domSession: DOMCodeSession | null = null
let previewQueue = Promise.resolve()
let pendingPreview: Promise<void> | undefined
let commitPromise: Promise<void> | undefined
let updateVersion = 0
let disposing = false

/** Set by "Write JSX": the editor stays open for new layers until something is selected. */
const composing = ref(false)

/**
 * Generated code needs a selection; without one the panel says so instead of showing a
 * template that looks like a real layer. Writing new Design JSX is an explicit action.
 */
const showEmptyState = computed(
  () =>
    source.value !== 'html-css' &&
    store.state.selectedIds.size === 0 &&
    !composing.value &&
    !designSession.value &&
    !dirty.value
)

watch(
  () => store.state.selectedIds.size,
  (size) => {
    if (size > 0) composing.value = false
  }
)

function writeJSX() {
  composing.value = true
}
const codeLayers = useCodeLayers(source)

const generatedJSX = useSceneComputed((): GeneratedCode | null => {
  if (!editorActive.value || source.value === 'html-css' || designSession.value) return null
  void store.state.sceneVersion
  return generatedCodeFor(source.value, store.graph, [...store.state.selectedIds])
})

const sourceOptions = computed(() => [
  { value: 'design-jsx' as const, label: code.value.sourceDesignJSX },
  { value: 'tailwind-jsx' as const, label: code.value.sourceTailwindJSX },
  { value: 'html-css' as const, label: code.value.sourceHTMLCSS }
])
const readOnly = computed(() => source.value === 'tailwind-jsx')
const dirty = computed(() => draft.value !== baseline.value)
const editorLabel = computed(() =>
  source.value === 'html-css' ? code.value.editorHTMLCSSLabel : code.value.editorDesignLabel
)
const statusTone = computed(() => {
  if (status.value === 'error') return 'error'
  if (status.value === 'updated') return 'success'
  return 'neutral'
})
const statusStyles = computed(() => tv(statusTheme)({ tone: statusTone.value }))

const statusText = computed(() => {
  if (status.value === 'updating') return code.value.updating
  if (status.value === 'error') return code.value.previewFailed
  if (dirty.value) return code.value.updatedLive
  return code.value.jsxUpToDate
})

function beginDesignSession(): DesignJSXEditSession | null {
  if (designSession.value) return designSession.value
  const result = createDesignJSXEditSession(store)
  if (!result.ok) {
    status.value = 'error'
    error.value = result.error
    return null
  }
  designSession.value = result.session
  return result.session
}

function beginDOMSession(): DOMCodeSession {
  domSession ??= createDOMCodeSession(store)
  return domSession
}

async function commitCurrentSession(): Promise<void> {
  if (commitPromise) return commitPromise
  const operation = (async () => {
    await pendingPreview
    await previewQueue
    updateVersion += 1
    const design = designSession.value
    const dom = domSession
    designSession.value = null
    domSession = null
    if (design) commitDesignJSXSession(store, design)
    if (dom) commitDOMCodeSession(store, dom)
    pendingPreview = undefined
  })()
  commitPromise = operation
  try {
    await operation
  } finally {
    if (commitPromise === operation) commitPromise = undefined
  }
}

async function runPreview(version: number): Promise<void> {
  if (version !== updateVersion || readOnly.value || !draft.value.trim()) return
  status.value = 'updating'
  error.value = ''
  let result: { ok: true } | { ok: false; error: string }
  let previewLayers: DesignJSXLayerLine[] | null = null
  if (source.value === 'html-css') {
    result = await previewDOMCode(store, beginDOMSession(), draft.value)
  } else {
    const session = beginDesignSession()
    const preview = session
      ? await previewDesignJSX(store, session, draft.value)
      : ({ ok: false, error: error.value } as const)
    if (preview.ok) previewLayers = preview.layers
    result = preview
  }
  if (version !== updateVersion) return
  if (previewLayers) codeLayers.showPreview(previewLayers)
  if (!result.ok) {
    status.value = 'error'
    error.value = result.error
    return
  }
  status.value = 'updated'
}

const schedulePreview = useDebounceFn(
  (version: number) => {
    previewQueue = previewQueue.then(() => runPreview(version))
    return previewQueue
  },
  350,
  { maxWait: 1_000 }
)

function updateDraft(value: string): void {
  draft.value = value
  error.value = ''
  updateVersion += 1
  pendingPreview = schedulePreview(updateVersion)
}

async function resetDraft(): Promise<void> {
  updateVersion += 1
  await pendingPreview
  await previewQueue
  const design = designSession.value
  const dom = domSession
  designSession.value = null
  domSession = null
  if (design) resetDesignJSXPreview(store, design)
  if (dom) resetDOMCodePreview(store, dom)
  pendingPreview = undefined
  draft.value = baseline.value
  codeLayers.restoreGenerated()
  error.value = ''
  status.value = 'idle'
}

async function changeSource(next: CodeSource): Promise<void> {
  if (next === source.value) return
  await commitCurrentSession()
  source.value = next
  const generated = next === 'html-css' ? null : generatedFor(next)
  const initial = generated?.code ?? starterSourceFor(next)
  codeLayers.showGenerated(generated)
  baseline.value = initial
  draft.value = initial
  error.value = ''
  status.value = 'idle'
}

/**
 * Scene and selection at which an edit settled. The code stays as written until either changes;
 * then the canvas is the newer intent and the code is generated from it again.
 */
let settledAt: string | null = null

function sceneKey(): string {
  return `${store.state.sceneVersion}:${[...store.state.selectedIds].join(',')}`
}

/**
 * Leaving the editor ends a live edit, as leaving a text field does: the preview becomes one
 * undo step, so canvas edits that follow are recorded after it and flow back into the code.
 */
async function settleEdit(): Promise<void> {
  // A keystroke just before leaving has a preview scheduled that has not opened a session yet.
  await pendingPreview
  if (!designSession.value && !domSession) return
  await commitCurrentSession()
  baseline.value = draft.value
  settledAt = sceneKey()
}

function generatedFor(next: Exclude<CodeSource, 'html-css'>): GeneratedCode {
  return generatedCodeFor(next, store.graph, [...store.state.selectedIds])
}

watch(
  generatedJSX,
  (generated) => {
    if (!generated || source.value === 'html-css' || designSession.value || dirty.value) return
    if (settledAt === sceneKey()) return
    settledAt = null
    codeLayers.showGenerated(generated)
    baseline.value = generated.code
    draft.value = generated.code
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  disposing = true
  void commitCurrentSession()
})

watch(
  () => editorActive.value,
  (value) => {
    if (!value && !disposing) void settleEdit()
  }
)
</script>

<template>
  <div data-test-id="code-panel-root" class="flex min-h-0 flex-1 flex-col">
    <header class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
      <AppSelect
        :model-value="source"
        :options="sourceOptions"
        :label="code.source"
        data-test-id="code-panel-source"
        :ui="{ trigger: 'h-7 min-w-0 flex-1 text-[11px]' }"
        @update:model-value="changeSource"
      />
      <Tip v-if="source !== 'html-css'" :label="code.copyJSXReference">
        <AppButton
          color="neutral"
          variant="ghost"
          size="xs"
          shape="square"
          data-test-id="code-panel-copy-ref"
          @click="copyReference(JSX_REFERENCE)"
        >
          <icon-lucide-check v-if="copiedReference" class="size-3 text-[var(--color-success)]" />
          <icon-lucide-book-open v-else class="size-3" />
        </AppButton>
      </Tip>
    </header>

    <AppPlaceholder
      v-if="showEmptyState"
      :label="code.noSelection"
      :description="
        source === 'design-jsx' ? code.noSelectionDesignJSX : code.noSelectionTailwindJSX
      "
      :fill="false"
      :ui="{ root: 'pt-10' }"
      data-test-id="code-panel-empty"
    >
      <template #icon>
        <icon-lucide-code class="size-4" />
      </template>
      <template v-if="source === 'design-jsx'" #action>
        <AppButton color="neutral" variant="soft" size="xs" @click="writeJSX">
          <icon-lucide-pencil class="size-3" />
          {{ code.writeJSX }}
        </AppButton>
      </template>
    </AppPlaceholder>

    <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CodeEditor
        :autofocus="composing"
        :model-value="draft"
        :language="source"
        :read-only="readOnly"
        :label="editorLabel"
        :layer-links="codeLayers.links.value"
        :layer-issues="codeLayers.issues.value"
        @update:model-value="updateDraft"
        @active-layers="codeLayers.markActive"
        @blur="settleEdit"
      />
    </div>

    <div
      v-if="error"
      role="alert"
      data-test-id="code-panel-error"
      class="shrink-0 border-t border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-[11px] leading-snug text-[var(--color-error)]"
    >
      {{ error }}
    </div>

    <footer
      v-if="!showEmptyState"
      class="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2"
    >
      <span
        data-test-id="code-panel-status"
        class="min-w-0 truncate"
        :data-tone="statusTone"
        :class="statusStyles.text()"
      >
        {{ readOnly ? code.generatedReadOnly : statusText }}
      </span>
      <div class="flex items-center gap-1">
        <AppButton
          v-if="dirty && !readOnly"
          color="neutral"
          variant="ghost"
          size="xs"
          data-test-id="code-panel-reset"
          @click="resetDraft"
        >
          <icon-lucide-rotate-ccw class="size-3" />
          {{ code.reset }}
        </AppButton>
        <AppButton
          color="neutral"
          variant="ghost"
          size="xs"
          data-test-id="code-panel-copy"
          @click="copy(draft)"
        >
          <icon-lucide-check v-if="copied" class="size-3 text-[var(--color-success)]" />
          <icon-lucide-copy v-else class="size-3" />
          {{ copied ? common.copied : common.copy }}
        </AppButton>
      </div>
    </footer>
  </div>
</template>
