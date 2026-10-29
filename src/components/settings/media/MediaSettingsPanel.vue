<script setup lang="ts">
import { computed, ref } from 'vue'

import { useMediaMessages, useSettingsMessages } from '@open-pencil/vue/i18n'

import { vectorizeProviderID, VECTORIZE_PROVIDER_DEFINITIONS } from '@/app/editor/vectorize'
import { pexelsKeyStatus, unsplashKeyStatus } from '@/app/settings/credentials/media'
import type { MediaSettingsService } from '@/app/settings/media/use'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppActionRow from '@/components/ui/list/AppActionRow.vue'
import { useHeldContent } from '@/components/ui/overlay/held'
import PanelDrillIn from '@/components/ui/panel/PanelDrillIn.vue'

import MediaCredentialEditor from './MediaCredentialEditor.vue'

const editing = ref<MediaSettingsService | null>(null)
// The editor keeps its service while it slides away.
const editedService = useHeldContent(editing)
const settings = useSettingsMessages()
const media = useMediaMessages()
const stockServices = computed(() => [
  { id: 'pexels' as const, name: 'Pexels', status: pexelsKeyStatus.value },
  { id: 'unsplash' as const, name: 'Unsplash', status: unsplashKeyStatus.value }
])
const vectorProvider = computed(() =>
  VECTORIZE_PROVIDER_DEFINITIONS.find((item) => item.id === vectorizeProviderID.value)
)
</script>

<template>
  <PanelDrillIn :open="editing !== null" data-test-id="settings-media-panel">
    <template #detail>
      <MediaCredentialEditor
        v-if="editedService"
        :key="editedService"
        :service="editedService"
        @done="editing = null"
      />
    </template>
    <SettingsPage>
      <div class="flex flex-col gap-6">
        <SettingsSection>
          <template #title>{{ settings.media }}</template>
          <AppActionRow
            v-for="service in stockServices"
            :key="service.id"
            @click="editing = service.id"
          >
            {{ service.name }}
            <template #description>{{
              service.status === 'configured' ? settings.configured : settings.notConfigured
            }}</template>
            <template #trailing
              >{{ settings.edit }}<icon-lucide-chevron-right class="size-3.5"
            /></template>
          </AppActionRow>
        </SettingsSection>
        <SettingsSection>
          <template #title>{{ media.vectorization }}</template>
          <template #description>{{ media.vectorizationDescription }}</template>
          <AppActionRow data-vectorize-settings @click="editing = 'vectorize'">
            {{ vectorProvider?.name }}
            <template #trailing
              >{{ settings.edit }}<icon-lucide-chevron-right class="size-3.5"
            /></template>
          </AppActionRow>
        </SettingsSection>
      </div>
    </SettingsPage>
  </PanelDrillIn>
</template>
