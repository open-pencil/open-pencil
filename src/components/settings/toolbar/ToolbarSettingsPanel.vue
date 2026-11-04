<script setup lang="ts">
import { isEqual } from 'es-toolkit'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { DEFAULT_TOOLBAR_LAYOUT } from '@/app/editor/toolbar/layout'
import { appPreferences, updateToolbarLayout } from '@/app/settings/preferences/store'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import ToolbarLayoutEditor from '@/components/settings/toolbar/ToolbarLayoutEditor.vue'

const { settings } = useI18n()

const layout = computed({
  get: () => appPreferences.value.toolbar,
  set: updateToolbarLayout
})

const modified = computed(() => !isEqual(layout.value, DEFAULT_TOOLBAR_LAYOUT))

function reset() {
  updateToolbarLayout(structuredClone(DEFAULT_TOOLBAR_LAYOUT))
}
</script>

<template>
  <section class="flex flex-col gap-6" data-test-id="settings-toolbar-panel">
    <SettingsSection :modified="modified" @reset="reset">
      <template #title>{{ settings.toolbar }}</template>
      <template #description>{{ settings.toolbarDescription }}</template>
      <ToolbarLayoutEditor v-model="layout" />
    </SettingsSection>
  </section>
</template>
