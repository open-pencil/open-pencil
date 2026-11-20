<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ColorProfile } from '@open-pencil/scene-graph'
import type { FigCompression } from '@open-pencil/scene-graph/fig-compression'
import { useI18n } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import { useEditorStore } from '@/app/editor/active-store'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import ColorProfileDialog from './ColorProfileDialog.vue'

/** Settings for the whole document, shown with nothing selected. */
const store = useEditorStore()
const { panels } = useI18n()
const current = useSceneComputed(() => store.figCompression())

const compressionOptions = computed<Array<{ value: FigCompression; label: string }>>(() => [
  { value: 'fast', label: panels.value.compressionFast },
  { value: 'smaller', label: panels.value.compressionSmaller },
  { value: 'smallest', label: panels.value.compressionSmallest }
])

const compression = computed<FigCompression>({
  get: () => current.value,
  set: (value) => store.setFigCompression(value)
})

const profileOptions = computed<Array<{ value: ColorProfile; label: string }>>(() => [
  { value: 'srgb', label: panels.value.colorProfileSRGB },
  { value: 'display-p3', label: panels.value.colorProfileDisplayP3 }
])

/** The profile picked and waiting on Assign or Convert. */
const pendingProfile = ref<ColorProfile | null>(null)
const pendingName = computed(() => {
  const pending = pendingProfile.value
  return pending && (profileOptions.value.find((option) => option.value === pending)?.label ?? null)
})

const profile = computed<ColorProfile>({
  get: () => store.state.documentColorSpace,
  set: (value) => {
    if (value !== store.state.documentColorSpace) pendingProfile.value = value
  }
})

function changeProfile(mode: 'assign' | 'convert') {
  if (pendingProfile.value) store.setDocumentColorSpace(pendingProfile.value, mode)
  pendingProfile.value = null
}
</script>

<template>
  <PanelSection :label="panels.document" data-test-id="document-section">
    <PanelFieldGroup :label="panels.compression">
      <AppSelect
        v-model="compression"
        :label="panels.compression"
        :options="compressionOptions"
        data-property="fig-compression"
      />
    </PanelFieldGroup>
    <PanelFieldGroup :label="panels.colorProfile" class="mt-1.5">
      <AppSelect
        v-model="profile"
        :label="panels.colorProfile"
        :options="profileOptions"
        data-property="color-profile"
      />
    </PanelFieldGroup>
    <ColorProfileDialog
      :profile-name="pendingName"
      @choose="changeProfile"
      @cancel="pendingProfile = null"
    />
  </PanelSection>
</template>
