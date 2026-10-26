<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'

import { settingsDialogAnchor, type SettingsAnchor } from '@/app/settings/dialog'
import FontSettingsPanel from '@/components/settings/fonts/FontSettingsPanel.vue'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import ToolbarSettingsPanel from '@/components/settings/toolbar/ToolbarSettingsPanel.vue'

import NavigationSettingsSection from './NavigationSettingsSection.vue'
import RenderingSettingsSection from './RenderingSettingsSection.vue'
import SnappingSettingsSection from './SnappingSettingsSection.vue'

/** How the canvas and its tools behave: snapping, navigation, the toolbar, fonts, and rendering. */
const toolbar = useTemplateRef<HTMLElement>('toolbar')
const fonts = useTemplateRef<HTMLElement>('fonts')

// Customize toolbar and the Typography gear open this page on their part of it.
watch(
  settingsDialogAnchor,
  async (anchor: SettingsAnchor | null) => {
    if (!anchor) return
    await nextTick()
    const target = anchor === 'toolbar' ? toolbar.value : fonts.value
    target?.scrollIntoView({ block: 'start' })
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
      <div ref="fonts" class="scroll-mt-4">
        <FontSettingsPanel />
      </div>
      <RenderingSettingsSection />
    </div>
  </SettingsPage>
</template>
