<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { useId } from 'vue'

import { settingsTheme } from '@open-pencil/vue/theme'

import { useSettingsSectionHeading } from './heading'
import SettingsResetButton from './SettingsResetButton.vue'

const ui = tv(settingsTheme)()

/**
 * A titled block of settings. A setting edited as a whole, such as the toolbar's layout, is
 * `modified` on its section, which then offers the same Reset to default as a changed row does.
 */
const { modified = false } = defineProps<{
  /** The section's setting differs from its default. */
  modified?: boolean
}>()
const emit = defineEmits<{ reset: [] }>()
const headingId = useId()
const heading = useSettingsSectionHeading()
</script>

<template>
  <section :class="ui.section()" :aria-labelledby="headingId">
    <div :class="ui.sectionHeader()">
      <div :class="ui.sectionText()">
        <component :is="heading" :id="headingId" :class="ui.sectionTitle()">
          <slot name="title" />
        </component>
        <p v-if="$slots.description" :class="ui.sectionDescription()">
          <slot name="description" />
        </p>
      </div>
      <div v-if="modified || $slots.actions" :class="ui.sectionActions()">
        <SettingsResetButton v-if="modified" @reset="emit('reset')" />
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </section>
</template>
