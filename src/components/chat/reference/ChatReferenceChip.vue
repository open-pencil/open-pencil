<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref } from 'vue'

import { useAIMessages } from '@open-pencil/vue/i18n'

import type { ChatReference } from '@/app/ai/chat/references/link'
import { openReference, resolveReference } from '@/app/ai/chat/references/resolve'
import { foundSkills } from '@/app/ai/skills/library'
import { getActiveEditorStoreOrNull, useActiveEditorStoreRef } from '@/app/editor/active-store'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import { CHAT_NODES_LIVE } from '@/components/chat/tool/context'
import { chatReferenceTheme } from '@/components/chat/ui'
import { sceneNodeIcon } from '@/components/icons'

/**
 * A layer, page, or skill named in chat text. In the transcript it shows its target when
 * clicked; in the composer it is part of the text and only shows what it names.
 */
const { reference, interactive = true } = defineProps<{
  reference: ChatReference
  interactive?: boolean
}>()

const ai = useAIMessages()
const ui = chatReferenceTheme()
const live = inject(CHAT_NODES_LIVE, ref(true))
const activeStore = useActiveEditorStoreRef()

const resolved = computed(() => {
  const store = activeStore.value
  // The graph is not reactive; the scene version changes with every edit to it.
  void store?.state.sceneVersion
  const skillNames = new Set(foundSkills.value.skills.map((skill) => skill.name))
  return resolveReference(live.value ? (store ?? null) : null, reference, skillNames)
})

const label = computed(() =>
  reference.kind === 'skill'
    ? ai.value.openSkillSettings({ name: resolved.value.name })
    : ai.value.showNodeOnCanvas({ name: resolved.value.name })
)

/** Pointing at a layer's chip outlines the layer on the canvas, as the layers panel does. */
function hover(on: boolean) {
  const store = getActiveEditorStoreOrNull()
  if (!store || reference.kind !== 'node' || !resolved.value.present) return
  if (on) store.setHoveredNode(reference.id)
  else if (store.state.hoveredNodeId === reference.id) store.setHoveredNode(null)
}

onBeforeUnmount(() => hover(false))

async function open() {
  const store = getActiveEditorStoreOrNull()
  if (!store || !resolved.value.present) return
  try {
    await openReference(store, reference)
  } catch (error) {
    // A newer page switch supersedes this one.
    if (error instanceof Error && error.name === 'AbortError') return
    toast.error(
      notificationMessages.get().operationFailed({
        error: error instanceof Error ? error.message : String(error)
      })
    )
  }
}
</script>

<template>
  <component
    :is="interactive ? 'button' : 'span'"
    :type="interactive ? 'button' : undefined"
    :class="ui.root()"
    :disabled="interactive && !resolved.present ? true : undefined"
    :aria-label="interactive ? label : undefined"
    :data-present="resolved.present"
    :data-reference-kind="reference.kind"
    data-slot="chat-reference"
    @click="interactive && void open()"
    @pointerenter="hover(true)"
    @pointerleave="hover(false)"
  >
    <component
      :is="sceneNodeIcon(resolved.node)"
      v-if="resolved.node"
      :class="ui.icon()"
      aria-hidden="true"
    />
    <icon-lucide-file v-else-if="reference.kind === 'page'" :class="ui.icon()" aria-hidden="true" />
    <icon-lucide-book-open
      v-else-if="reference.kind === 'skill'"
      :class="ui.icon()"
      aria-hidden="true"
    />
    <icon-lucide-crosshair v-else :class="ui.icon()" aria-hidden="true" />
    <span :class="ui.label()">{{ resolved.name }}</span>
  </component>
</template>
