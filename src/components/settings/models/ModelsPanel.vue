<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useModelSettings } from '@/app/ai/models/settings/use'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import ProfileEditor from '@/components/settings/models/ProfileEditor.vue'
import RoleAssignments from '@/components/settings/models/RoleAssignments.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppActionRow from '@/components/ui/list/AppActionRow.vue'
import PanelDrillIn from '@/components/ui/panel/PanelDrillIn.vue'

const { ai, collaboration, common } = useI18n()
const editing = defineModel<boolean>('editing', { default: false })
const editingProfileId = ref<string>()
onUnmounted(() => {
  editing.value = false
})

function addModel(): void {
  editingProfileId.value = undefined
  editing.value = true
}

function editModel(profileId: string): void {
  editingProfileId.value = profileId
  editing.value = true
}

function statusLabel(connectionId: string, providerID: string): string {
  if (providerID.startsWith('acp:')) return ai.value.modelAgentConnection
  const status = statusByConnection.value[connectionId]
  if (status === 'configured') return collaboration.value.connected
  if (status === 'locked' || status === 'unavailable') return common.value.unavailable
  return ai.value.modelNeedsCredential
}

function closeEditor(): void {
  editing.value = false
  void refreshStatuses()
}

const { profiles, statusByConnection, refreshStatuses } = useModelSettings()
</script>

<template>
  <PanelDrillIn :open="editing" :back="common.back" :parent="ai.modelsTitle" @back="closeEditor">
    <template #detail>
      <ProfileEditor
        :key="editingProfileId ?? 'new'"
        :profile-id="editingProfileId"
        @done="closeEditor"
        @deleted="closeEditor"
      />
    </template>

    <SettingsPage>
      <div class="flex flex-col gap-6">
        <SettingsSection>
          <template #title>{{ ai.modelsTitle }}</template>
          <template #description>{{ ai.modelsDescription }}</template>
          <template #actions>
            <AppButton
              color="primary"
              variant="solid"
              data-test-id="settings-add-model"
              @click="addModel"
            >
              <template #leading><icon-lucide-plus class="size-3" /></template>
              {{ ai.addModel }}
            </AppButton>
          </template>

          <div class="flex flex-col gap-1.5" data-test-id="settings-model-list">
            <AppActionRow
              v-for="profile in profiles"
              :key="profile.id"
              :data-model-id="profile.id"
              :ui="{
                root: 'py-3 max-sm:flex-wrap',
                label: 'text-xs',
                description: 'text-[11px] leading-relaxed',
                trailing: 'max-sm:w-full max-sm:justify-end'
              }"
              @click="editModel(profile.id)"
            >
              <template #leading>
                <span class="flex size-8 items-center justify-center rounded bg-panel"
                  ><icon-lucide-bot class="size-4"
                /></span>
              </template>
              {{ profile.name }}
              <template #description>
                {{ profile.providerName
                }}<span v-if="profile.modelName"> · {{ profile.modelName }}</span>
              </template>
              <template #trailing>
                <span
                  class="mr-1 flex items-center gap-1 text-[11px] text-muted"
                  :data-state="
                    statusByConnection[profile.connectionId] === 'configured'
                      ? 'configured'
                      : 'missing'
                  "
                >
                  <span
                    class="size-1.5 rounded-full bg-muted data-[state=configured]:bg-[var(--color-success)]"
                    :data-state="
                      statusByConnection[profile.connectionId] === 'configured'
                        ? 'configured'
                        : 'missing'
                    "
                  />
                  {{ statusLabel(profile.connectionId, profile.providerID) }}
                </span>
                <span
                  v-for="capability in profile.capabilities"
                  :key="capability"
                  class="rounded bg-panel px-1.5 py-0.5 text-[11px] text-muted"
                >
                  {{
                    capability === 'tools'
                      ? ai.modelCapabilityToolsShort
                      : ai.modelCapabilityVisionShort
                  }}
                </span>
                <icon-lucide-chevron-right class="size-3.5 shrink-0 text-muted" />
              </template>
            </AppActionRow>
          </div>
        </SettingsSection>

        <SettingsSection>
          <template #title>{{ ai.modelAssignments }}</template>
          <template #description>{{ ai.modelAssignmentsDescription }}</template>
          <RoleAssignments />
        </SettingsSection>
        <slot />
      </div>
    </SettingsPage>
  </PanelDrillIn>
</template>
