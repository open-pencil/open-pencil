<script setup lang="ts">
import { templateRef } from '@vueuse/core'
import { nextTick, ref, onUnmounted } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useModelSettings } from '@/app/ai/models/settings/use'
import ProfileEditor from '@/components/settings/models/ProfileEditor.vue'
import RoleAssignments from '@/components/settings/models/RoleAssignments.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppActionRow from '@/components/ui/list/AppActionRow.vue'
import { modelPanelTransition } from '@/theme/settings/models'

const { ai, collaboration, common } = useI18n()
const editing = defineModel<boolean>('editing', { default: false })
const editingProfileId = ref<string>()
const editorLeaving = ref(false)
const panel = templateRef<HTMLElement>('panel')
let returnFocus: HTMLElement | null = null
function captureFocus() {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
}
async function restoreFocus() {
  editorLeaving.value = false
  await nextTick()
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
  returnFocus = null
}
async function focusEditor() {
  await nextTick()
  panel.value
    ?.querySelector<HTMLInputElement>('[data-test-id="settings-model-editor"] input')
    ?.focus({ preventScroll: true })
}
onUnmounted(() => {
  editing.value = false
})

function addModel(): void {
  captureFocus()
  editingProfileId.value = undefined
  editing.value = true
}

function editModel(profileId: string): void {
  captureFocus()
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
  editorLeaving.value = true
  editing.value = false
  void refreshStatuses()
}

const { profiles, statusByConnection, refreshStatuses } = useModelSettings()
</script>

<template>
  <div ref="panel" class="relative flex min-h-0 flex-1 flex-col">
    <Transition
      v-bind="modelPanelTransition"
      @after-enter="focusEditor"
      @after-leave="restoreFocus"
    >
      <div v-if="editing" class="absolute inset-0 flex min-h-0 flex-col">
        <ProfileEditor
          :key="editingProfileId ?? 'new'"
          :profile-id="editingProfileId"
          @done="closeEditor"
          @deleted="closeEditor"
        />
      </div>
    </Transition>

    <div
      v-show="!editing && !editorLeaving"
      class="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1"
    >
      <section>
        <div class="mb-2 flex items-center justify-between">
          <div>
            <h3 class="text-xs font-semibold text-surface">{{ ai.modelsTitle }}</h3>
            <p class="text-[10px] text-muted">{{ ai.modelsDescription }}</p>
          </div>
          <AppButton
            color="primary"
            variant="solid"
            data-test-id="settings-add-model"
            @click="addModel"
          >
            <template #leading><icon-lucide-plus class="size-3" /></template>
            {{ ai.addModel }}
          </AppButton>
        </div>

        <div class="flex flex-col gap-1.5" data-test-id="settings-model-list">
          <AppActionRow
            v-for="profile in profiles"
            :key="profile.id"
            :data-model-id="profile.id"
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
                class="mr-1 flex items-center gap-1 text-[9px] text-muted"
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
                class="rounded bg-panel px-1.5 py-0.5 text-[9px] text-muted"
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
      </section>

      <section class="mt-5 border-t border-border pt-4">
        <div class="mb-3">
          <h3 class="text-xs font-semibold text-surface">{{ ai.modelAssignments }}</h3>
          <p class="text-[10px] text-muted">{{ ai.modelAssignmentsDescription }}</p>
        </div>
        <RoleAssignments />
      </section>
      <slot />
    </div>
  </div>
</template>
