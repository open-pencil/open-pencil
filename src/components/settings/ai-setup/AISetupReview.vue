<script setup lang="ts">
import { ONBOARDING_ROLES, type OnboardingPlan } from '@/app/ai/models/settings/onboarding/plan'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'

import { useRoleLabels } from './role-label'

const { plan } = defineProps<{ plan: OnboardingPlan }>()
const { choiceLabel, roleLabel } = useRoleLabels()
</script>

<template>
  <SettingsGroup>
    <SettingsRow
      v-for="role in ONBOARDING_ROLES"
      :key="role"
      :label="roleLabel(role).label"
      :description="choiceLabel(plan[role])"
      :data-model-role="role"
    />
  </SettingsGroup>
</template>
