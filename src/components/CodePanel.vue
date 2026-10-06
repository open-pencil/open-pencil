<script setup lang="ts">
import { useClipboard, useDebounceFn } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  ref,
  shallowRef,
  nextTick,
  useTemplateRef,
  watch
} from 'vue'

import { JSX_REFERENCE } from '@open-pencil/design-jsx'
import type { SceneNode } from '@open-pencil/scene-graph'
import { useEditorEvent, useI18n } from '@open-pencil/vue'

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
  createDesignJSXEditSession,
  previewDesignJSX,
  reapplyCanvasEdits,
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
/** The person has written in the code since it was generated for the current selection. */
const edited = ref(false)
const status = ref<'idle' | 'updating' | 'updated' | 'error'>('idle')
const error = ref('')
const designSession = shallowRef<DesignJSXEditSession | null>(null)
const codeEditor = useTemplateRef<InstanceType<typeof CodeEditor>>('codeEditor')
let domSession: DOMCodeSession | null = null
let previewQueue = Promise.resolve()
let pendingPreview: Promise<void> | undefined
let commitPromise: Promise<void> | undefined
let updateVersion = 0
/** Previews in flight; their canvas changes come from the code, not onto it. */
let previewing = 0
/** Scene version a preview left the canvas at, which the code already describes. */
let previewedVersion: number | null = null
/** The selection the code was generated for. */
let followedSelection: string | null = null
/** Code typed since the last preview started, which the canvas does not show yet. */
let previewDue = false
/**
 * Canvas edits made while code waits to render. Code replaced as a whole has no links to patch
 * them into until its preview links it again, so they are applied once more after that preview.
 */
let canvasEdits = new Map<string, Partial<SceneNode>>()

useEditorEvent('node:updated', (id, changes) => {
  if (!previewDue || previewing > 0 || source.value !== 'design-jsx') return
  canvasEdits.set(id, { ...canvasEdits.get(id), ...structuredClone(changes) })
})

function takeCanvasEdits(): Map<string, Partial<SceneNode>> {
  const edits = canvasEdits
  canvasEdits = new Map()
  previewDue = false
  return edits
}

/** Hands edits taken by a superseded or failed preview to the next one, behind any made since. */
function returnCanvasEdits(edits: ReadonlyMap<string, Partial<SceneNode>>) {
  for (const [id, changes] of edits) canvasEdits.set(id, { ...changes, ...canvasEdits.get(id) })
}

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
    !edited.value
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

const sourceOptions = computed(() => [
  { value: 'design-jsx' as const, label: code.value.sourceDesignJSX },
  { value: 'tailwind-jsx' as const, label: code.value.sourceTailwindJSX },
  { value: 'html-css' as const, label: code.value.sourceHTMLCSS }
])
const readOnly = computed(() => source.value === 'tailwind-jsx')
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
  if (edited.value) return code.value.updatedLive
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

/** Design JSX previews are recorded as they apply; an HTML/CSS preview is committed here. */
async function commitCurrentSession(): Promise<void> {
  if (commitPromise) return commitPromise
  const operation = (async () => {
    await pendingPreview
    await previewQueue
    updateVersion += 1
    takeCanvasEdits()
    const dom = domSession
    designSession.value = null
    domSession = null
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
  const edits = takeCanvasEdits()
  status.value = 'updating'
  error.value = ''
  previewing += 1
  let result: { ok: true } | { ok: false; error: string }
  let previewLayers: DesignJSXLayerLine[] | null = null
  try {
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
  } finally {
    previewing -= 1
    previewedVersion = store.state.sceneVersion
    followedSelection = selectionKey.value
  }
  if (version !== updateVersion) {
    returnCanvasEdits(edits)
    return
  }
  if (previewLayers) codeLayers.showPreview(previewLayers)
  if (!result.ok) {
    status.value = 'error'
    error.value = result.error
    // The code still waits to render, so its next preview applies these and later edits.
    previewDue = true
    returnCanvasEdits(edits)
    return
  }
  status.value = 'updated'
  const session = designSession.value
  if (!session || edits.size === 0) return
  // Once the code is linked again, the edits reach it as canvas changes do.
  await nextTick()
  if (version === updateVersion) reapplyCanvasEdits(store, session, edits)
  else returnCanvasEdits(edits)
}

const schedulePreview = useDebounceFn(
  (version: number) => {
    previewQueue = previewQueue.then(() => runPreview(version))
    return previewQueue
  },
  350,
  { maxWait: 1_000 }
)

function updateDraft(value: string, origin: 'user' | 'layers'): void {
  draft.value = value
  // Patches from the canvas already match it; only the person's typing renders.
  if (origin === 'layers') return
  edited.value = true
  error.value = ''
  updateVersion += 1
  previewDue = true
  pendingPreview = schedulePreview(updateVersion)
}

async function resetDraft(): Promise<void> {
  updateVersion += 1
  await pendingPreview
  await previewQueue
  takeCanvasEdits()
  const design = designSession.value
  const dom = domSession
  designSession.value = null
  domSession = null
  if (design) resetDesignJSXPreview(store, design)
  if (dom) resetDOMCodePreview(store, dom)
  pendingPreview = undefined
  error.value = ''
  status.value = 'idle'
  edited.value = false
  if (source.value === 'html-css') draft.value = starterSourceFor('html-css')
  else showCanvas(source.value)
}

async function changeSource(next: CodeSource): Promise<void> {
  if (next === source.value) return
  await commitCurrentSession()
  source.value = next
  edited.value = false
  error.value = ''
  status.value = 'idle'
  if (next === 'html-css') {
    codeLayers.showGenerated(null)
    draft.value = starterSourceFor(next)
  } else {
    showCanvas(next)
  }
}

const selectionKey = computed(() => [...store.state.selectedIds].join(','))

/** Shows the code generated for the selection, replacing whatever the editor held. */
function showCanvas(next: Exclude<CodeSource, 'html-css'>) {
  const generated: GeneratedCode = generatedCodeFor(next, store.graph, [...store.state.selectedIds])
  followedSelection = selectionKey.value
  codeLayers.showGenerated(generated)
  draft.value = generated.code
}

/**
 * Keeps the code in step with the canvas, like the Design panel. Code nobody has written in is
 * generated again; code the person wrote is patched where layers changed, keeping the rest as
 * written. Another selection starts over with its generated code.
 */
function followCanvas(live = false) {
  const current = source.value
  if (!editorActive.value || current === 'html-css' || previewing > 0) return
  if (selectionKey.value !== followedSelection) {
    if (designSession.value) designSession.value = null
    edited.value = false
  }
  if (!edited.value) {
    showCanvas(current)
    return
  }
  // A live preview leaves the scene version alone, so it is followed whatever the version.
  if (!live && store.state.sceneVersion === previewedVersion) return
  codeEditor.value?.patchFromLayers()
}

watch([() => store.state.sceneVersion, selectionKey, source, editorActive], () => followCanvas(), {
  immediate: true
})

/** Dragging or scrubbing a value previews it; the code follows once per frame, like the Design panel. */
let livePreviewFrame = 0
useEditorEvent('node:previewUpdated', () => {
  if (livePreviewFrame) return
  livePreviewFrame = requestAnimationFrame(() => {
    livePreviewFrame = 0
    followCanvas(true)
  })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(livePreviewFrame)
  void commitCurrentSession()
})

watch(
  () => editorActive.value,
  (value) => {
    if (!value) void commitCurrentSession()
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
        ref="codeEditor"
        :autofocus="composing"
        :model-value="draft"
        :language="source"
        :read-only="readOnly"
        :label="editorLabel"
        :layer-links="codeLayers.links.value"
        :layer-issues="codeLayers.issues.value"
        @update:model-value="updateDraft"
        :describe-layer="source === 'design-jsx' ? codeLayers.describe : undefined"
        :layer-snippet="source === 'design-jsx' ? codeLayers.snippet : undefined"
        @active-layers="codeLayers.markActive"
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
          v-if="edited && !readOnly"
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
