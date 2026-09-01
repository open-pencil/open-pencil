<script setup lang="ts">
import { useClipboard, useDebounceFn } from '@vueuse/core'
import { computed, defineAsyncComponent, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { tv } from 'tailwind-variants'

import { JSX_REFERENCE, selectionToJSX } from '@open-pencil/core/design-jsx'
import { useI18n, useSceneComputed } from '@open-pencil/vue'

import {
  commitDesignJSXSession,
  createDesignJSXEditSession,
  previewDesignJSX,
  resetDesignJSXPreview,
  type DesignJSXEditSession
} from '@/app/code/live-preview'
import {
  commitDOMCodeSession,
  createDOMCodeSession,
  previewDOMCode,
  resetDOMCodePreview,
  type DOMCodeSession
} from '@/app/code/dom-preview'
import { starterSourceFor, type CodeSource } from '@/app/code/templates'
import { useEditorStore } from '@/app/editor/active-store'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Tip from '@/components/ui/Tip.vue'
import statusTheme from '@/theme/status'

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

const generatedJSX = useSceneComputed(() => {
  if (!editorActive.value || source.value === 'html-css' || designSession.value) return ''
  void store.state.sceneVersion
  const ids = [...store.state.selectedIds]
  if (ids.length === 0) return starterSourceFor(source.value)
  return selectionToJSX(
    ids,
    store.graph,
    source.value === 'tailwind-jsx' ? 'tailwind' : 'openpencil'
  )
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
  if (source.value === 'html-css') {
    result = await previewDOMCode(store, beginDOMSession(), draft.value)
  } else {
    const session = beginDesignSession()
    result = session
      ? await previewDesignJSX(store, session, draft.value)
      : { ok: false, error: error.value }
  }
  if (version !== updateVersion) return
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
  error.value = ''
  status.value = 'idle'
}

async function changeSource(next: CodeSource): Promise<void> {
  if (next === source.value) return
  await commitCurrentSession()
  source.value = next
  const initial = next === 'html-css' ? starterSourceFor(next) : generatedFor(next)
  baseline.value = initial
  draft.value = initial
  error.value = ''
  status.value = 'idle'
}

function generatedFor(next: Exclude<CodeSource, 'html-css'>): string {
  const ids = [...store.state.selectedIds]
  if (ids.length === 0) return starterSourceFor(next)
  return selectionToJSX(ids, store.graph, next === 'tailwind-jsx' ? 'tailwind' : 'openpencil')
}

watch(
  generatedJSX,
  (value) => {
    if (source.value === 'html-css' || designSession.value || dirty.value) return
    baseline.value = value
    draft.value = value
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
    if (!value && !disposing) void commitCurrentSession()
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

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CodeEditor
        :model-value="draft"
        :language="source"
        :read-only="readOnly"
        :label="editorLabel"
        @update:model-value="updateDraft"
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
