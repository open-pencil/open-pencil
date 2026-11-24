<script setup lang="ts">
import { computed } from 'vue'

import { useMessages } from '@open-pencil/vue/i18n'

import { useDesignPromptSetting } from '@/app/ai/prompts/settings/use'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import PromptEditor from './PromptEditor.vue'
import PromptTemplateSection from './PromptTemplateSection.vue'

/**
 * The prompts a person can write their own of: the Design agent's instructions, added to
 * OpenPencil's or in their place, and the Knap templates for reviews, chat titles, and
 * compaction summaries.
 */
const ai = useMessages('ai')
const design = useDesignPromptSetting()
const { text: designText, mode: designMode, modified: designModified } = design
const modes = computed(() => [
  { value: 'add' as const, label: ai.value.promptDesignAdd },
  { value: 'replace' as const, label: ai.value.promptDesignReplace }
])
</script>

<template>
  <SettingsPage data-test-id="settings-prompts">
    <div class="flex flex-col gap-8">
      <SettingsSection :modified="designModified" data-prompt="design" @reset="design.reset()">
        <template #title>{{ ai.modelRoleDesign }}</template>
        <template #description>{{ ai.promptDesignDescription }}</template>
        <template #actions>
          <AppButton
            v-if="!designText"
            size="xs"
            variant="outline"
            data-test-id="settings-prompt-start"
            @click="design.startFromBuiltIn()"
          >
            {{ ai.promptDesignStart }}
          </AppButton>
        </template>
        <AppSelect
          v-model="designMode"
          class="w-full max-w-64"
          :options="modes"
          :label="ai.promptDesignMode"
        />
        <PromptEditor
          v-model="designText"
          :label="ai.modelRoleDesign"
          :placeholder="ai.promptDesignPlaceholder"
        />
        <AppAlert
          v-if="designMode === 'replace' && designText.trim()"
          tone="warning"
          :heading="ai.promptDesignReplaced"
          :description="ai.promptDesignReplaceWarning"
        />
      </SettingsSection>
      <PromptTemplateSection prompt="review" :heading="ai.modelRoleReview">
        <template #description>{{ ai.promptReviewDescription }}</template>
      </PromptTemplateSection>
      <PromptTemplateSection prompt="title" :heading="ai.promptTitle">
        <template #description>{{ ai.promptTitleDescription }}</template>
      </PromptTemplateSection>
      <PromptTemplateSection prompt="summary" :heading="ai.promptSummary">
        <template #description>{{ ai.promptSummaryDescription }}</template>
      </PromptTemplateSection>
    </div>
  </SettingsPage>
</template>
