<script setup lang="ts">
import { ref, onUnmounted, useTemplateRef } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { openAISetup } from '@/app/ai/models/settings/onboarding/dialog'
import {
  useModelConnectionStates,
  type ModelConnectionState
} from '@/app/ai/models/settings/status'
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
const editor = useTemplateRef('editor')

/** The editor opens on its name field rather than the back control. */
function focusEditor(event: Event): void {
  if (!editor.value) return
  event.preventDefault()
  editor.value.focus()
}
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

function statusLabel(state: ModelConnectionState): string {
  switch (state) {
    case 'connected':
      return collaboration.value.connected
    case 'needs-credential':
      return ai.value.modelNeedsCredential
    case 'unavailable':
      return common.value.unavailable
    case 'checking':
      return ai.value.modelConnectionChecking
    case 'not-installed':
      return ai.value.modelNotInstalled
    case 'installed':
      return ai.value.modelInstalled
    case 'signed-out':
      return ai.value.modelSignedOut
    case 'tools-unreachable':
      return ai.value.modelToolsUnreachable
    case 'agent':
      return ai.value.modelAgentConnection
  }
}

/** Green when it works, amber when the person has something to fix, grey otherwise. */
function statusTone(state: ModelConnectionState): 'ok' | 'attention' | 'neutral' {
  if (state === 'connected') return 'ok'
  if (state === 'signed-out' || state === 'tools-unreachable' || state === 'not-installed') {
    return 'attention'
  }
  return 'neutral'
}

function closeEditor(): void {
  editing.value = false
  void refreshStatuses()
  void refreshAgents()
}

const { profiles, statusByConnection, refreshStatuses } = useModelSettings()
const { connectionState, refresh: refreshAgents } = useModelConnectionStates(statusByConnection)
</script>

<template>
  <!-- The Settings window's breadcrumb is the way back, so the drill-in draws no back bar. -->
  <PanelDrillIn :open="editing" @open-auto-focus="focusEditor">
    <template #detail>
      <ProfileEditor
        ref="editor"
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
                  data-test-id="settings-model-status"
                  :data-state="connectionState(profile.connectionId, profile.providerID)"
                >
                  <span
                    class="size-1.5 rounded-full bg-muted data-[tone=attention]:bg-warning data-[tone=ok]:bg-success"
                    :data-tone="
                      statusTone(connectionState(profile.connectionId, profile.providerID))
                    "
                  />
                  {{ statusLabel(connectionState(profile.connectionId, profile.providerID)) }}
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
          <AppButton
            color="primary"
            variant="link"
            size="xs"
            class="self-start"
            data-test-id="settings-run-ai-setup"
            @click="openAISetup()"
          >
            <template #leading><icon-lucide-sparkles class="size-3" /></template>
            {{ ai.aiSetupRun }}
          </AppButton>
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
