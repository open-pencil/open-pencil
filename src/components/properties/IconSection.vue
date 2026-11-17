<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { ref, watch } from 'vue'

import type { IconOption } from '@open-pencil/core/icons'
import { colorToHex, parseColor } from '@open-pencil/scene-graph/color'
import { iconLayerName, type IconOptions } from '@open-pencil/scene-graph/icons'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { useIcon } from '@open-pencil/vue/controls/icon'
import { useCommonMessages, usePanelMessages } from '@open-pencil/vue/i18n'

import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import IconPicker from '@/components/icon-picker/IconPicker.vue'
import IconPreview from '@/components/icon-picker/IconPreview.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import ExternalLink from '@/components/links/ExternalLink.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'
import { useHeldContent } from '@/components/ui/overlay/held'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { SF_SYMBOLS_DOCS_URL } from '@/constants'
import theme from '@/theme/select/app'

const panels = usePanelMessages()
const common = useCommonMessages()
const {
  frameId,
  name,
  color,
  preview,
  setName,
  options,
  controls,
  unavailable,
  setOption,
  modified,
  swap,
  reset,
  detach,
  setColor,
  setColorPicking
} = useIcon()
const styles = tv(theme)()

/**
 * A change that draws the icon afresh, waiting for its edits to be given up: another icon, or
 * another value for one of the options it is drawn with.
 */
type PendingChange = { icon: string } | { key: string; value: IconOptions[string] }
const pending = ref<PendingChange | null>(null)
const pendingShown = useHeldContent(pending)
// The question is about the icon selected when it was asked; another selection drops it, so a
// confirmation never changes an icon it did not describe.
watch(frameId, () => {
  pending.value = null
})

function apply(change: PendingChange) {
  if ('icon' in change) void swap(change.icon)
  else void setOption(change.key, change.value)
}

function request(change: PendingChange) {
  if (modified.value) pending.value = change
  else apply(change)
}

function confirmPending() {
  const change = pending.value
  pending.value = null
  if (change) apply(change)
}

/** The value the icon is drawn with for `option`, or the option's default. */
function optionValue(option: IconOption) {
  return options.value[option.key] ?? option.default
}

/** A value of a choice as a menu shows it: `semibold` as Semibold. */
function valueLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// An option color is drawn again when the open picker closes, rather than for every color a drag
// passes through; a color typed in while it is closed is drawn at once.
const pickingOption = ref<string | null>(null)
const pickedColor = ref<string | null>(null)

function setOptionColor(key: string, next: Color) {
  const hex = colorToHex(next)
  if (pickingOption.value === key) pickedColor.value = hex
  else request({ key, value: hex })
}

function setOptionColorPicking(key: string, open: boolean) {
  if (open) {
    pickingOption.value = key
    return
  }
  const hex = pickedColor.value
  pickingOption.value = null
  pickedColor.value = null
  if (hex) request({ key, value: hex })
}
</script>

<template>
  <PanelSection v-if="name" :label="panels.icon">
    <template #actions>
      <span v-if="modified" class="me-1 text-2xs text-muted" data-property="icon-modified">
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
        @select="request({ icon: $event })"
      >
        <template #trigger>
          <button
            type="button"
            aria-haspopup="listbox"
            data-property="icon-name"
            :aria-label="panels.swapIcon"
            :class="styles.trigger()"
          >
            <IconPreview :svg="preview" class="me-1.5 size-3.5 text-surface" />
            <span :class="styles.value()">
              {{ iconLayerName(name) }}
              <span class="text-muted">{{ setName ?? name.slice(0, name.indexOf(':')) }}</span>
            </span>
            <icon-lucide-chevron-down :class="styles.chevron()" />
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
    <p v-if="unavailable" class="mt-1.5 text-2xs text-muted" data-property="icon-unavailable">
      {{ unavailable === 'host' ? panels.sfSymbolsNeedMacApp : panels.sfSymbolsNeedNewerMacOS }}
      <ExternalLink :href="SF_SYMBOLS_DOCS_URL">{{ common.learnMore }}</ExternalLink>
    </p>
    <PanelGrid
      v-else-if="controls.length > 0"
      :columns="2"
      class="mt-1.5"
      data-property="icon-options"
    >
      <PanelFieldGroup v-for="option in controls" :key="option.key" :label="option.name">
        <NumberField
          v-if="'min' in option"
          :model-value="Number(optionValue(option))"
          :aria-label="option.name"
          :min="option.min"
          :max="option.max"
          :step="option.step"
          :data-property="`icon-option-${option.key}`"
          @commit="(value: number) => request({ key: option.key, value })"
        />
        <AppSelect
          v-else-if="'values' in option"
          :label="option.name"
          :model-value="String(optionValue(option))"
          :options="option.values.map((value) => ({ value, label: valueLabel(value) }))"
          :data-property="`icon-option-${option.key}`"
          @update:model-value="request({ key: option.key, value: $event })"
        />
        <ColorInput
          v-else
          :color="
            parseColor(
              pickingOption === option.key && pickedColor
                ? pickedColor
                : String(optionValue(option))
            )
          "
          editable
          :data-property="`icon-option-${option.key}`"
          @update="setOptionColor(option.key, $event)"
          @open-change="setOptionColorPicking(option.key, $event)"
        />
      </PanelFieldGroup>
    </PanelGrid>
    <AppConfirmationDialog
      :open="pending !== null"
      :heading="panels.swapEditedIconHeading"
      :description="
        pendingShown && 'key' in pendingShown
          ? panels.redrawEditedIconDescription
          : panels.swapEditedIconDescription({
              name: iconLayerName(pendingShown && 'icon' in pendingShown ? pendingShown.icon : '')
            })
      "
      :confirm-label="pendingShown && 'key' in pendingShown ? panels.redrawIcon : panels.swapIcon"
      tone="warning"
      @update:open="(open: boolean) => !open && (pending = null)"
      @confirm="confirmPending"
    />
  </PanelSection>
</template>
