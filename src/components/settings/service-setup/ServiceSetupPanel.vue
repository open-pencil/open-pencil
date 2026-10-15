<script setup lang="ts">
import { useSettingsMessages } from '@open-pencil/vue'

import { openSettingsDialog } from '@/app/settings/dialog'
import { useServiceSetup, type ServiceSetupItem } from '@/app/settings/service-setup/use'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppActionRow from '@/components/ui/list/AppActionRow.vue'

import { useServiceSetupLabels } from './labels'

/** Every service OpenPencil can connect to, whether it is set up, and the way to set it up. */
const settings = useSettingsMessages()
const { groups } = useServiceSetup()

const { groupLabels, itemLabels } = useServiceSetupLabels()

function statusLabel(item: ServiceSetupItem): string {
  if (item.status === 'done') return settings.value.configured
  if (item.status === 'local-only') return settings.value.serviceSetupLocalOnly
  return settings.value.notConfigured
}
</script>

<template>
  <SettingsPage>
    <div class="flex flex-col gap-6" data-test-id="settings-service-setup-panel">
      <p class="text-xs text-muted">{{ settings.serviceSetupDescription }}</p>
      <SettingsSection v-for="group in groups" :key="group.id" :data-service-group="group.id">
        <template #title>{{ groupLabels[group.id] }}</template>
        <template #description>{{
          settings.serviceSetupProgress({ done: group.done, total: group.total })
        }}</template>
        <AppActionRow
          v-for="item in group.items"
          :key="item.id"
          :data-service="item.id"
          :data-status="item.status"
          @click="openSettingsDialog(item.section)"
        >
          <template #leading>
            <icon-lucide-circle-check v-if="item.status === 'done'" class="size-4 text-success" />
            <icon-lucide-triangle-alert
              v-else-if="item.status === 'local-only'"
              class="size-4 text-warning-action"
            />
            <icon-lucide-circle-dashed v-else class="size-4 text-muted" />
          </template>
          {{ itemLabels[item.id] }}
          <template #description>{{ statusLabel(item) }}</template>
          <template #trailing
            >{{ item.status === 'done' ? settings.edit : settings.serviceSetupSetUp
            }}<icon-lucide-chevron-right class="size-3.5"
          /></template>
        </AppActionRow>
      </SettingsSection>
    </div>
  </SettingsPage>
</template>
