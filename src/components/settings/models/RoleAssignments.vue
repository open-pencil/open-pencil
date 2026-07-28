<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@open-pencil/vue'

import {
  aiModelSettings,
  isACPModelProfile,
  modelProfile,
  setModelRoleAssignment,
  type AIModelRole,
  type OptionalAIModelRole
} from '@/app/ai/models'
import AppSelect from '@/components/ui/AppSelect.vue'

const { dialogs } = useI18n()
const SAME_AS_DESIGN = '__design__'
const NO_MODEL = '__none__'

const roleDefinitions = computed(() => [
  {
    role: 'design' as const,
    label: dialogs.value.modelRoleDesign,
    description: dialogs.value.modelRoleDesignDescription
  },
  {
    role: 'review' as const,
    label: dialogs.value.modelRoleReview,
    description: dialogs.value.modelRoleReviewDescription
  },
  {
    role: 'fast' as const,
    label: dialogs.value.modelRoleFast,
    description: dialogs.value.modelRoleFastDescription
  },
  {
    role: 'vision' as const,
    label: dialogs.value.modelRoleVision,
    description: dialogs.value.modelRoleVisionDescription
  }
])

function assignmentValue(role: AIModelRole): string {
  const assignment = aiModelSettings.value.assignments[role]
  if (assignment === null) return NO_MODEL
  return assignment === 'design' ? SAME_AS_DESIGN : assignment
}

function optionsForRole(role: AIModelRole) {
  const profiles = aiModelSettings.value.models
    .filter((profile) => {
      if (role === 'design') return profile.capabilities.includes('tools')
      if (isACPModelProfile(profile)) return false
      if (role === 'vision') return profile.capabilities.includes('vision')
      return true
    })
    .map((profile) => ({ value: profile.id, label: profile.name }))
  if (role === 'design') return profiles

  const design = modelProfile(aiModelSettings.value.assignments.design)
  const canInherit =
    !isACPModelProfile(design) && (role !== 'vision' || design?.capabilities.includes('vision'))
  return [
    ...(canInherit ? [{ value: SAME_AS_DESIGN, label: dialogs.value.modelRoleUseDesign }] : []),
    { value: NO_MODEL, label: dialogs.value.noModel },
    ...profiles
  ]
}

function updateAssignment(role: AIModelRole, value: string): void {
  if (role === 'design') {
    const profile = modelProfile(value)
    if (profile) setModelRoleAssignment('design', profile.id)
    return
  }
  if (value === NO_MODEL) {
    setModelRoleAssignment(role as OptionalAIModelRole, null)
    return
  }
  if (value === SAME_AS_DESIGN) {
    setModelRoleAssignment(role as OptionalAIModelRole, 'design')
    return
  }
  const profile = modelProfile(value)
  if (profile) setModelRoleAssignment(role as OptionalAIModelRole, profile.id)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="definition in roleDefinitions"
      :key="definition.role"
      class="grid grid-cols-[10rem_minmax(0,1fr)] items-center gap-3"
      :data-model-role="definition.role"
    >
      <div class="min-w-0">
        <p class="text-[11px] font-medium text-surface">{{ definition.label }}</p>
        <p class="text-[10px] leading-tight text-muted">{{ definition.description }}</p>
      </div>
      <AppSelect
        :model-value="assignmentValue(definition.role)"
        :options="optionsForRole(definition.role)"
        :label="definition.label"
        :data-test-id="`settings-model-assignment-${definition.role}`"
        @update:model-value="updateAssignment(definition.role, String($event))"
      />
    </div>
  </div>
</template>
