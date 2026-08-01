<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import { documentKindRules } from '@open-pencil/core/editor'
import {
  editorCommandMetadata,
  formatShortcut,
  useEditorCommands,
  useI18n,
  useViewportKind
} from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import Tip from '@/components/ui/Tip.vue'
import presentationTheme from '@/theme/presentation'

const store = useEditorStore()
const { getCommand } = useEditorCommands()
const { commands } = useI18n()
const { isMobile } = useViewportKind()
const styles = tv(presentationTheme)()

const presentable = computed(
  () => documentKindRules(store.state.documentKind).presentable && !isMobile.value
)

const shortcut = formatShortcut(editorCommandMetadata('view.present').shortcut)
const tipLabel = computed(() => {
  const label = commands.value.present
  return shortcut ? `${label} (${shortcut})` : label
})

function onPresent() {
  getCommand('view.present').run()
}
</script>

<template>
  <Tip v-if="presentable" :label="tipLabel">
    <button
      type="button"
      data-test-id="present-button"
      :class="styles.presentButton()"
      :aria-label="commands.present"
      @click="onPresent"
    >
      <icon-lucide-play class="size-3.5" />
      <span>{{ commands.present }}</span>
    </button>
  </Tip>
</template>
