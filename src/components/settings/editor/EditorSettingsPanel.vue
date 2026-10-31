<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'

import { settingsDialogAnchor, type SettingsAnchor } from '@/app/settings/dialog'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import ToolbarSettingsPanel from '@/components/settings/toolbar/ToolbarSettingsPanel.vue'

import NavigationSettingsSection from './NavigationSettingsSection.vue'
import RenderingSettingsSection from './RenderingSettingsSection.vue'
import SnappingSettingsSection from './SnappingSettingsSection.vue'

/** How the canvas and its tools behave: snapping, navigation, the toolbar, and rendering. */
const toolbar = useTemplateRef<HTMLElement>('toolbar')

// Customize toolbar opens this page on the toolbar.
watch(
  settingsDialogAnchor,
  async (anchor: SettingsAnchor | null) => {
    if (!anchor) return
    await nextTick()
    if (anchor === 'toolbar') toolbar.value?.scrollIntoView({ block: 'start' })
    settingsDialogAnchor.value = null
  },
  { immediate: true }
)
</script>

<template>
  <SettingsPage data-test-id="settings-editor-panel">
    <div class="flex flex-col gap-6">
      <SnappingSettingsSection />
      <NavigationSettingsSection />
      <div ref="toolbar" class="scroll-mt-4">
        <ToolbarSettingsPanel />
      </div>
      <RenderingSettingsSection />
    </div>
  </SettingsPage>
</template>
