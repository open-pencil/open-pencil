<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { DEFAULT_TOOLBAR_LAYOUT } from '@/app/editor/toolbar/layout'
import { appPreferences, updateToolbarLayout } from '@/app/settings/preferences/store'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import ToolbarLayoutEditor from '@/components/settings/toolbar/ToolbarLayoutEditor.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

const { settings } = useI18n()

const layout = computed({
  get: () => appPreferences.value.toolbar,
  set: updateToolbarLayout
})

function reset() {
  updateToolbarLayout(structuredClone(DEFAULT_TOOLBAR_LAYOUT))
}
</script>

<template>
  <section class="flex flex-col gap-6" data-test-id="settings-toolbar-panel">
    <SettingsSection>
      <template #title>{{ settings.toolbar }}</template>
      <template #description>{{ settings.toolbarDescription }}</template>
      <template #actions>
        <AppButton @click="reset">
          {{ settings.toolbarReset }}
        </AppButton>
      </template>
      <ToolbarLayoutEditor v-model="layout" />
    </SettingsSection>
  </section>
</template>
