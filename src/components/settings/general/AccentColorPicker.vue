<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, shallowRef } from 'vue'

import { colorToHex } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { useSettingsMessages } from '@open-pencil/vue'

import { accentPreference } from '@/app/shell/accent'
import {
  ACCENT_PRESET_COLORS,
  ACCENT_PRESETS,
  accentBaseColor,
  type AccentPreference,
  type AccentPreset
} from '@/app/shell/accent/palette'
import ColorPicker from '@/components/ColorPicker/ColorPicker.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import theme from '@/theme/settings/accent'

const messages = useSettingsMessages()
const styles = tv(theme)()

const presetLabels = computed<Record<AccentPreset, string>>(() => ({
  blue: messages.value.accentBlue,
  purple: messages.value.accentPurple,
  pink: messages.value.accentPink,
  red: messages.value.accentRed,
  orange: messages.value.accentOrange,
  yellow: messages.value.accentYellow,
  green: messages.value.accentGreen,
  graphite: messages.value.accentGraphite
}))

const selectedPreset = computed(() =>
  accentPreference.value.kind === 'preset' ? accentPreference.value.preset : undefined
)
const custom = computed(() => accentPreference.value.kind === 'custom')
const customBackground = computed(() =>
  accentPreference.value.kind === 'custom' ? accentPreference.value.color : undefined
)
const customColor = computed(() => accentBaseColor(accentPreference.value))

function selectPreset(value: unknown): void {
  const preset = ACCENT_PRESETS.find((candidate) => candidate === value)
  if (preset) accentPreference.value = { kind: 'preset', preset }
}

/** The accent before the custom picker opened, restored when the edit is cancelled. */
const beforeEdit = shallowRef<AccentPreference | null>(null)

function onPickerOpenChange(open: boolean): void {
  if (open) beforeEdit.value = { ...accentPreference.value }
  else beforeEdit.value = null
}

function onCustomColor(color: Color): void {
  accentPreference.value = { kind: 'custom', color: colorToHex(color) }
}

function onCancel(): void {
  if (beforeEdit.value) accentPreference.value = beforeEdit.value
}
</script>

<template>
  <div :class="styles.root()" data-test-id="settings-accent">
    <RadioGroupRoot
      :model-value="selectedPreset"
      :aria-label="messages.accentColor"
      orientation="horizontal"
      :class="styles.presets()"
      @update:model-value="selectPreset"
    >
      <Tip v-for="preset in ACCENT_PRESETS" :key="preset" as-child :label="presetLabels[preset]">
        <RadioGroupItem
          :value="preset"
          :aria-label="presetLabels[preset]"
          :data-test-id="`settings-accent-${preset}`"
          :class="styles.swatch()"
          :style="{ background: ACCENT_PRESET_COLORS[preset] }"
        />
      </Tip>
    </RadioGroupRoot>

    <Tip :label="messages.accentCustom">
      <ColorPicker
        :color="customColor"
        @update="onCustomColor"
        @open-change="onPickerOpenChange"
        @cancel="onCancel"
      >
        <template #trigger>
          <button
            type="button"
            :aria-label="messages.accentCustom"
            :aria-pressed="custom"
            :data-active="custom"
            data-test-id="settings-accent-custom"
            :class="styles.custom()"
            :style="{ background: customBackground }"
          />
        </template>
      </ColorPicker>
    </Tip>
  </div>
</template>
