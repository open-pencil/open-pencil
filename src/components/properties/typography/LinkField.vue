<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import { linkFromInput } from '@open-pencil/core/text'
import type { HyperlinkTarget } from '@open-pencil/scene-graph'
import { useEditor } from '@open-pencil/vue'
import { useMessages } from '@open-pencil/vue/i18n'

import { textLinkRequests } from '@/app/editor/text-link'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'

/**
 * The link of a text's selected characters, or of the whole text when none are selected: a web,
 * mail, or phone link typed in, which Add link (Mod+K) focuses.
 */
const { nodeId } = defineProps<{ nodeId: string }>()

const editor = useEditor()
const typography = useMessages('panels/typography')
const input = useTemplateRef<InstanceType<typeof AppInput>>('input')

const link = computed<HyperlinkTarget | null>(() => {
  void editor.state.sceneVersion
  void editor.state.textSelectionVersion
  return editor.getTextLink(nodeId)
})
/** What the field shows: a URL, or the name of the layer a link leads to. */
const shown = computed(() => {
  const current = link.value
  if (!current) return ''
  if (current.type === 'URL') return current.value
  return editor.getNode(current.value)?.name ?? current.value
})
const draft = ref(shown.value)
const invalid = ref(false)
watch(shown, (value) => {
  draft.value = value
  invalid.value = false
})

watch(textLinkRequests, async () => {
  await nextTick()
  input.value?.focus()
  input.value?.select()
})

function commit() {
  if (draft.value === shown.value) {
    invalid.value = false
    return
  }
  const next = linkFromInput(draft.value)
  invalid.value = next === undefined
  if (next !== undefined) editor.setTextLink(nodeId, next)
}

function revert() {
  draft.value = shown.value
  invalid.value = false
}
</script>

<template>
  <PanelFieldGroup
    :label="typography.link"
    class="mb-3"
    :ui="{ container: 'flex-row items-center gap-1.5' }"
  >
    <AppInput
      ref="input"
      v-model="draft"
      class="min-w-0 flex-1"
      tone="panel"
      size="sm"
      type="url"
      :state="invalid ? 'invalid' : 'idle'"
      :aria-invalid="invalid || undefined"
      :placeholder="typography.linkPlaceholder"
      :aria-label="typography.link"
      :disabled="link?.type === 'NODE'"
      data-property="text-link"
      @enter="commit"
      @blur="commit"
      @keydown.escape="revert"
    />
    <IconButton
      v-if="link"
      :label="typography.removeLink"
      data-property="remove-text-link"
      @click="editor.setTextLink(nodeId, null)"
    >
      <icon-lucide-unlink class="size-3.5" />
    </IconButton>
  </PanelFieldGroup>
</template>
