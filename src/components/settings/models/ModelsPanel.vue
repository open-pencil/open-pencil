<script setup lang="ts">
import { useModelSettings } from '@/app/ai/models/settings/use'

import { ref } from 'vue'
import { useI18n } from '@open-pencil/vue'

import ProfileEditor from '@/components/settings/models/ProfileEditor.vue'
import RoleAssignments from '@/components/settings/models/RoleAssignments.vue'

const { ai, collaboration, common } = useI18n()
const editing = ref(false)
const editingProfileId = ref<string>()

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
  editingProfileId.value = undefined
  void refreshStatuses()
}

const { profiles, statusByConnection, refreshStatuses } = useModelSettings()
</script>

<template>
  <ProfileEditor
    v-if="editing"
    :key="editingProfileId ?? 'new'"
    :profile-id="editingProfileId"
    @done="closeEditor"
    @deleted="closeEditor"
  />

  <div v-else class="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
    <section>
      <div class="mb-2 flex items-center justify-between">
        <div>
          <h3 class="text-xs font-semibold text-surface">{{ ai.modelsTitle }}</h3>
          <p class="text-[10px] text-muted">{{ ai.modelsDescription }}</p>
        </div>
        <button
          type="button"
          class="flex items-center gap-1 rounded bg-accent px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90"
          data-test-id="settings-add-model"
          @click="addModel"
        >
          <icon-lucide-plus class="size-3" />
          {{ ai.addModel }}
        </button>
      </div>

      <div class="flex flex-col gap-1.5" data-test-id="settings-model-list">
        <button
          v-for="profile in profiles"
          :key="profile.id"
          type="button"
          class="group flex items-center gap-3 rounded border border-border bg-panel-field px-3 py-2 text-left hover:border-panel-focus hover:bg-panel-field-hover"
          :data-model-id="profile.id"
          @click="editModel(profile.id)"
        >
          <div class="flex size-8 shrink-0 items-center justify-center rounded bg-panel text-muted">
            <icon-lucide-bot class="size-4" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[11px] font-medium text-surface">{{ profile.name }}</p>
            <p class="truncate text-[10px] text-muted">
              {{ profile.providerName
              }}<span v-if="profile.modelName"> · {{ profile.modelName }}</span>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <span
              class="mr-1 flex items-center gap-1 text-[9px] text-muted"
              :data-state="
                statusByConnection[profile.connectionId] === 'configured' ? 'configured' : 'missing'
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
              class="rounded bg-panel px-1.5 py-0.5 text-[9px] text-muted"
            >
              {{
                capability === 'tools'
                  ? ai.modelCapabilityToolsShort
                  : ai.modelCapabilityVisionShort
              }}
            </span>
          </div>
          <icon-lucide-chevron-right class="size-3.5 shrink-0 text-muted" />
        </button>
      </div>
    </section>

    <section class="mt-5 border-t border-border pt-4">
      <div class="mb-3">
        <h3 class="text-xs font-semibold text-surface">{{ ai.modelAssignments }}</h3>
        <p class="text-[10px] text-muted">{{ ai.modelAssignmentsDescription }}</p>
      </div>
      <RoleAssignments />
    </section>
  </div>
</template>
