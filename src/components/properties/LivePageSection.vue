<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useLivePageMessages } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import { pageOrigin, selectionLocation } from '@/app/live-pages/bridge'
import { useLivePagesSource } from '@/app/live-pages/open'
import { parseRouteParams } from '@/app/live-pages/routes'
import { normalizeLiveURL, readLivePage } from '@/app/live-pages/schema'
import { useLivePageSelection } from '@/app/live-pages/selection'
import { useLivePages } from '@/app/live-pages/use'
import { openExternalLink } from '@/app/shell/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const store = useEditorStore()
const messages = useLivePageMessages()
const { setPage, link, reload } = useLivePages()
const { selectionOf } = useLivePageSelection()
const { project, baseAddress, listRoutes, openAll: openPages } = useLivePagesSource()

/** The selected frame, which is the only kind of layer a page can fill. */
const node = computed(() => {
  void store.state.sceneVersion
  const [id] = store.state.selectedIds
  const selected = id ? store.graph.getNode(id) : undefined
  return selected?.type === 'FRAME' ? selected : null
})

const page = computed(() => (node.value ? readLivePage(node.value) : null))

/** The element this frame's page last reported, and nothing another frame's page reported. */
const selection = computed(() => selectionOf(node.value?.id ?? null))

const draft = ref('')
// A frame starts from its own address, even when both frames are unlinked and both are empty:
// watching the address alone would leave one frame's draft under another, one link away from being
// written to the wrong frame.
watch(
  () => [node.value?.id ?? '', page.value?.url ?? ''] as const,
  ([, url]) => {
    draft.value = url
  },
  { immediate: true }
)

/** An address the app cannot load is shown as invalid, but never blocks an empty field. */
const typed = computed(() => draft.value.trim() !== '')
const valid = computed(() => !typed.value || normalizeLiveURL(draft.value) !== '')
/** The element that explains a refused address, which the field points at while it holds one. */
const URL_ERROR_ID = 'live-page-url-error'
const canApply = computed(() => {
  const target = node.value
  if (!target || !valid.value || !typed.value) return false
  return normalizeLiveURL(draft.value) !== (page.value?.url ?? '')
})

/** Pages can be listed only for a document saved inside a project with an address to reach. */
const address = computed(() => {
  if (baseAddress.value !== '') return baseAddress.value
  const url = page.value?.url
  return url ? (pageOrigin(url) ?? '') : ''
})
const canOpenAll = computed(() => project.value !== null && address.value !== '')

const opening = ref(false)
/** Values for the routes that take a parameter, written `slug=hello, id=42`. */
const paramsText = ref('')

function apply(): void {
  const target = node.value
  if (!target || !canApply.value) return
  link(target.id, draft.value)
}

function unlink(): void {
  const target = node.value
  if (!target) return
  setPage(target.id, null)
  draft.value = ''
}

function openPage(): void {
  const url = page.value?.url
  if (url) void openExternalLink(url)
}

async function openAll(): Promise<void> {
  if (opening.value || !canOpenAll.value) return
  // The address and parameters the person started with: a frame or project chosen while the routes
  // load must not be the one the pages open on.
  const base = address.value
  const params = parseRouteParams(paramsText.value)
  opening.value = true
  try {
    openPages(await listRoutes(), base, params)
  } finally {
    opening.value = false
  }
}

async function exportComponent(): Promise<void> {
  const target = node.value
  if (!target) return
  await store.exportTargets([{ target: { scope: 'node', nodeId: target.id }, formatId: 'vue-sfc' }])
}

async function copySelection(): Promise<void> {
  const current = selection.value
  if (!current) return
  await navigator.clipboard.writeText(selectionLocation(current))
}
</script>

<template>
  <PanelSection v-if="node" :label="messages.title">
    <template v-if="page" #actions>
      <IconButton :label="messages.reload" data-test-id="live-page-reload" @click="reload(node.id)">
        <icon-lucide-rotate-ccw class="size-3.5" />
      </IconButton>
      <IconButton :label="messages.open" data-test-id="live-page-open" @click="openPage">
        <icon-lucide-external-link class="size-3.5" />
      </IconButton>
      <IconButton :label="messages.unlink" data-test-id="live-page-unlink" @click="unlink">
        <icon-lucide-unlink class="size-3.5" />
      </IconButton>
    </template>

    <PanelFieldGroup :label="messages.url">
      <AppInput
        v-model="draft"
        type="url"
        :placeholder="messages.urlPlaceholder"
        :aria-label="messages.url"
        :aria-invalid="valid ? undefined : true"
        :aria-describedby="valid ? undefined : URL_ERROR_ID"
        :state="valid ? 'idle' : 'invalid'"
        tone="panel"
        data-test-id="live-page-url"
        @enter="apply"
      />
    </PanelFieldGroup>

    <!-- Said before the hint, so the reason a refused address is not used is read first. -->
    <p
      v-if="!valid"
      :id="URL_ERROR_ID"
      class="mt-1 text-2xs text-error"
      role="alert"
      data-test-id="live-page-url-error"
    >
      {{ messages.urlInvalid }}
    </p>

    <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
      <AppButton
        size="sm"
        variant="outline"
        :disabled="!canApply"
        data-test-id="live-page-link"
        @click="apply"
      >
        {{ messages.link }}
      </AppButton>
      <AppButton
        size="sm"
        variant="outline"
        :disabled="!page"
        data-test-id="live-page-export"
        @click="exportComponent"
      >
        {{ messages.exportVue }}
      </AppButton>
    </div>

    <div class="mt-2 border-t border-border pt-2">
      <PanelFieldGroup :label="messages.routeParams">
        <AppInput
          v-model="paramsText"
          :placeholder="messages.routeParamsPlaceholder"
          :aria-label="messages.routeParams"
          tone="panel"
          size="xs"
          data-test-id="live-pages-params"
        />
      </PanelFieldGroup>
      <div class="mt-1.5 flex items-center gap-1.5">
        <AppButton
          size="sm"
          variant="outline"
          :disabled="!canOpenAll || opening"
          data-test-id="live-pages-open-all"
          @click="openAll"
        >
          {{ messages.openAll }}
        </AppButton>
        <p class="min-w-0 flex-1 text-2xs leading-snug text-muted">{{ messages.openAllHint }}</p>
      </div>
    </div>

    <div v-if="selection" class="mt-2 flex items-center gap-1.5" data-test-id="live-page-selection">
      <span class="text-2xs text-muted">{{ messages.selectedInPage }}</span>
      <code class="min-w-0 flex-1 truncate text-2xs text-surface">{{
        selectionLocation(selection)
      }}</code>
      <IconButton :label="messages.copySelection" @click="copySelection">
        <icon-lucide-copy class="size-3.5" />
      </IconButton>
    </div>

    <p v-else class="mt-1.5 text-2xs leading-snug text-muted">{{ messages.hint }}</p>
  </PanelSection>
</template>
