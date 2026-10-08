<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { useIcon, usePanelMessages } from '@open-pencil/vue'

import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import IconPicker from '@/components/icon-picker/IconPicker.vue'
import IconPreview from '@/components/icon-picker/IconPreview.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import theme from '@/theme/select/app'

const panels = usePanelMessages()
const { name, color, preview, swap, setColor, setColorPicking } = useIcon()
const styles = tv(theme)()
</script>

<template>
  <PanelSection v-if="name" :label="panels.icon">
    <PanelFieldGroup :label="panels.swapIcon">
      <IconPicker
        :heading="panels.swapIcon"
        :selected="name"
        :set="name.slice(0, name.indexOf(':'))"
        @select="swap"
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
            <span :class="styles.value()">{{ name }}</span>
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
  </PanelSection>
</template>
