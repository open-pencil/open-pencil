<script setup lang="ts">
import { useModelRoleAssignments } from '@/app/ai/models/settings/assignments'

import { computed } from 'vue'
import { useI18n } from '@open-pencil/vue'

import AppSelect from '@/components/ui/AppSelect.vue'

const { ai } = useI18n()

const roleDefinitions = computed(() => [
  {
    role: 'design' as const,
    label: ai.value.modelRoleDesign,
    description: ai.value.modelRoleDesignDescription
  },
  {
    role: 'review' as const,
    label: ai.value.modelRoleReview,
    description: ai.value.modelRoleReviewDescription
  },
  {
    role: 'fast' as const,
    label: ai.value.modelRoleFast,
    description: ai.value.modelRoleFastDescription
  },
  {
    role: 'vision' as const,
    label: ai.value.modelRoleVision,
    description: ai.value.modelRoleVisionDescription
  }
])

const { assignmentValue, optionsForRole, updateAssignment } = useModelRoleAssignments(ai)
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
