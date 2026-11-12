<script setup lang="ts">
import { isEqual } from 'es-toolkit'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { DEFAULT_TOOLBAR_DOCK, isToolbarAlign, isToolbarSide } from '@/app/editor/toolbar/dock'
import { DEFAULT_TOOLBAR_LAYOUT } from '@/app/editor/toolbar/layout'
import {
  appPreferences,
  updateToolbarDock,
  updateToolbarLayout
} from '@/app/settings/preferences/store'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import ToolbarLayoutEditor from '@/components/settings/toolbar/ToolbarLayoutEditor.vue'
import { useToolbarAlignOptions, useToolbarSideOptions } from '@/components/toolbar/dock'
import LeftToRight from '@/components/ui/direction/LeftToRight.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

const { settings } = useI18n()
const sideOptions = useToolbarSideOptions()
const alignOptions = useToolbarAlignOptions(() => appPreferences.value.toolbarDock.side)

const layout = computed({
  get: () => appPreferences.value.toolbar,
  set: updateToolbarLayout
})

const side = computed({
  get: (): string => appPreferences.value.toolbarDock.side,
  set: (value: string) => {
    if (isToolbarSide(value)) updateToolbarDock({ side: value })
  }
})

const align = computed({
  get: (): string => appPreferences.value.toolbarDock.align,
  set: (value: string) => {
    if (isToolbarAlign(value)) updateToolbarDock({ align: value })
  }
})

const modified = computed(
  () =>
    !isEqual(layout.value, DEFAULT_TOOLBAR_LAYOUT) ||
    !isEqual(appPreferences.value.toolbarDock, DEFAULT_TOOLBAR_DOCK)
)

function sideIcon(value: string) {
  return sideOptions.value.find((option) => option.value === value)?.icon
}

function reset() {
  updateToolbarLayout(structuredClone(DEFAULT_TOOLBAR_LAYOUT))
  updateToolbarDock(DEFAULT_TOOLBAR_DOCK)
}
</script>

<template>
  <section class="flex flex-col gap-6" data-test-id="settings-toolbar-panel">
    <SettingsSection :modified="modified" @reset="reset">
      <template #title>{{ settings.toolbar }}</template>
      <template #description>{{ settings.toolbarDescription }}</template>
      <SettingsGroup>
        <SettingsRow :label="settings.toolbarPosition" class="max-sm:flex-col max-sm:items-stretch">
          <LeftToRight>
            <SegmentedControl
              v-model="side"
              :options="sideOptions"
              :label="settings.toolbarPosition"
              data-test-id="settings-toolbar-position"
            >
              <template #option="{ option }">
                <span class="flex items-center gap-1.5">
                  <component :is="sideIcon(option.value)" class="size-3.5" />
                  {{ option.label }}
                </span>
              </template>
            </SegmentedControl>
          </LeftToRight>
        </SettingsRow>
        <SettingsRow
          :label="settings.toolbarAlignment"
          class="max-sm:flex-col max-sm:items-stretch"
        >
          <LeftToRight>
            <SegmentedControl
              v-model="align"
              :options="alignOptions"
              :label="settings.toolbarAlignment"
              data-test-id="settings-toolbar-alignment"
            />
          </LeftToRight>
        </SettingsRow>
      </SettingsGroup>
      <ToolbarLayoutEditor v-model="layout" />
    </SettingsSection>
  </section>
</template>
