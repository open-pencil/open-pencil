<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { ref, watch } from 'vue'

import { iconLayerName } from '@open-pencil/scene-graph'
import { useCommonMessages, useIcon, usePanelMessages } from '@open-pencil/vue'

import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import IconPicker from '@/components/icon-picker/IconPicker.vue'
import IconPreview from '@/components/icon-picker/IconPreview.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import theme from '@/theme/select/app'

const panels = usePanelMessages()
const common = useCommonMessages()
const {
  frameId,
  name,
  color,
  preview,
  setName,
  modified,
  swap,
  reset,
  detach,
  setColor,
  setColorPicking
} = useIcon()
const styles = tv(theme)()

/** An icon picked to replace an edited one, waiting for the edits to be given up. */
const pendingSwap = ref<string | null>(null)
// The question is about the icon selected when it was asked; another selection drops it, so a
// confirmation never swaps an icon it did not describe.
watch(frameId, () => {
  pendingSwap.value = null
})

function pick(next: string) {
  if (modified.value) pendingSwap.value = next
  else void swap(next)
}

function confirmSwap() {
  const next = pendingSwap.value
  pendingSwap.value = null
  if (next) void swap(next)
}
</script>

<template>
  <PanelSection v-if="name" :label="panels.icon">
    <template #actions>
      <span v-if="modified" class="mr-1 text-[11px] text-muted" data-property="icon-modified">
        {{ panels.iconModified }}
      </span>
      <IconButton v-if="modified" :label="panels.resetIcon" @click="reset">
        <icon-lucide-rotate-ccw class="size-3.5" />
      </IconButton>
      <IconButton :label="panels.detachIcon" @click="detach">
        <icon-lucide-unlink class="size-3.5" />
      </IconButton>
    </template>
    <PanelFieldGroup :label="panels.swapIcon">
      <IconPicker
        :heading="panels.swapIcon"
        :selected="name"
        :set="name.slice(0, name.indexOf(':'))"
        @select="pick"
      >
        <template #trigger>
          <button
            type="button"
            aria-haspopup="listbox"
            data-property="icon-name"
            :aria-label="panels.swapIcon"
            :class="styles.trigger()"
          >
            <IconPreview :svg="preview" class="mr-1.5 size-3.5 text-surface" />
            <span :class="styles.value()">
              {{ iconLayerName(name) }}
              <span class="text-muted">{{ setName ?? name.slice(0, name.indexOf(':')) }}</span>
            </span>
            <icon-lucide-chevron-down class="ml-1 size-3 shrink-0 text-muted" />
          </button>
        </template>
      </IconPicker>
    </PanelFieldGroup>
    <PanelFieldGroup v-if="color" :label="panels.iconColor" class="mt-1.5">
      <ColorInput
        :color="color"
        editable
        data-property="icon-color"
        @update="setColor"
        @open-change="setColorPicking"
      />
    </PanelFieldGroup>
    <AppConfirmationDialog
      :open="pendingSwap !== null"
      :heading="panels.swapEditedIconHeading"
      :description="panels.swapEditedIconDescription({ name: iconLayerName(pendingSwap ?? '') })"
      :cancel-label="common.cancel"
      :confirm-label="panels.swapIcon"
      tone="warning"
      @update:open="(open: boolean) => !open && (pendingSwap = null)"
      @confirm="confirmSwap"
    />
  </PanelSection>
</template>
