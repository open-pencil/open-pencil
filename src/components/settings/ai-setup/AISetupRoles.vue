<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import {
  roleChoiceKey,
  type OnboardingPlan,
  type PlannedRole
} from '@/app/ai/models/settings/onboarding/plan'
import { AI_MODEL_ROLES, type AIModelRole } from '@/app/ai/models/types'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import { useRoleLabels } from './role-label'

const { plan, options, isRecommended } = defineProps<{
  plan: OnboardingPlan
  options: (role: AIModelRole) => PlannedRole[]
  isRecommended: boolean
}>()
const emit = defineEmits<{ choose: [role: AIModelRole, key: string]; useRecommended: [] }>()
const { ai } = useI18n()
const { choiceLabel, roleLabel } = useRoleLabels()

function selectOptions(role: AIModelRole) {
  return options(role).map((option) => ({
    value: roleChoiceKey(option),
    label: choiceLabel(option)
  }))
}
</script>

<template>
  <SettingsGroup>
    <SettingsRow
      v-for="role in AI_MODEL_ROLES"
      :key="role"
      class="max-sm:flex-col max-sm:items-stretch"
      :label="roleLabel(role).label"
      :description="roleLabel(role).description"
      :data-model-role="role"
    >
      <AppSelect
        class="w-full sm:w-64"
        :model-value="roleChoiceKey(plan[role])"
        :options="selectOptions(role)"
        :label="roleLabel(role).label"
        @update:model-value="emit('choose', role, String($event))"
      />
    </SettingsRow>
  </SettingsGroup>
  <AppButton v-if="!isRecommended" class="self-start" @click="emit('useRecommended')">
    {{ ai.aiSetupUseRecommended }}
  </AppButton>
</template>
