<script setup lang="ts">
import { ref } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import type { TemplatePrompt } from '@/app/ai/prompts/definitions'
import { useTemplatePromptSetting } from '@/app/ai/prompts/settings/use'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PromptEditor from './PromptEditor.vue'

/** One Knap prompt: its template, the variables it can read, and how it reads filled in. */
const { prompt, heading } = defineProps<{ prompt: TemplatePrompt; heading: string }>()
const { ai } = useI18n()
const setting = useTemplatePromptSetting(prompt)
const { text, modified, variables, check, preview } = setting
const previewOpen = ref(false)
/** How the template writes each variable, as `{{ name }}`. */
const variableTags = variables.map((name) => `{{ ${name} }}`)
</script>

<template>
  <SettingsSection :modified="modified" :data-prompt="prompt" @reset="setting.reset()">
    <template #title>{{ heading }}</template>
    <template #description><slot name="description" /></template>
    <PromptEditor
      v-model="text"
      template
      :label="heading"
      :check="check"
      :unknown-variable-message="(name) => ai.promptUnknownVariable({ name })"
    />
    <p v-if="variableTags.length > 0" class="flex flex-wrap items-center gap-1 text-2xs text-muted">
      <span>{{ ai.promptVariables }}</span>
      <code
        v-for="tag in variableTags"
        :key="tag"
        class="rounded bg-hover px-1 py-0.5 font-mono text-3xs text-surface"
        v-text="tag"
      />
    </p>
    <AppAlert
      v-if="check.errors.length > 0"
      tone="warning"
      :heading="ai.promptErrors"
      :description="ai.promptErrorsHint"
      data-test-id="settings-prompt-errors"
    />
    <AppCollapsible
      v-model:open="previewOpen"
      :label="ai.promptPreview"
      :ui="{ trigger: 'gap-1 py-1 text-2xs text-muted hover:text-surface', icon: 'size-3' }"
    >
      <!-- The model reads the prompt as text, so it shows as text, with its own line breaks. -->
      <p
        class="rounded-md bg-hover px-2.5 py-2 text-xs leading-relaxed whitespace-pre-wrap"
        data-test-id="settings-prompt-preview"
        v-text="preview"
      />
    </AppCollapsible>
  </SettingsSection>
</template>
