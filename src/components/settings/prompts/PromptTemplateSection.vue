<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import type { PromptVariables, TemplatePrompt } from '@/app/ai/prompts/definitions'
import { useTemplatePromptSetting } from '@/app/ai/prompts/settings/use'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import { focusStyles } from '@/theme/focus/styles'

import PromptEditor from './PromptEditor.vue'

/** One Knap prompt: its template, the variables it can read, and how it reads filled in. */
const { prompt, heading } = defineProps<{ prompt: TemplatePrompt; heading: string }>()
const { ai } = useI18n()
const setting = useTemplatePromptSetting(prompt)
const { text, modified, samples, check, preview } = setting
const previewOpen = ref(false)
const variablesOpen = ref(false)
const editor = useTemplateRef('editor')
/** The first error and its line, then that OpenPencil's prompt stands in meanwhile. */
const errorSummary = computed(() => {
  const [first] = check.value.errors
  if (!first) return ai.value.promptErrorsHint
  return `${ai.value.promptErrorAt({ line: first.line, message: first.message })} ${ai.value.promptErrorsHint}`
})
/** What each prompt's variables hold; a variable added to a prompt without one fails to compile. */
const descriptions = computed(() => {
  const m = ai.value
  const all: { [Id in TemplatePrompt]: Record<keyof PromptVariables<Id>, string> } = {
    review: {
      language: m.promptVariableLanguage,
      focus: m.promptVariableFocus,
      sees_images: m.promptVariableSeesImages,
      references: m.promptVariableReferences,
      edit: m.promptVariableEdit
    },
    title: { request: m.promptVariableRequest, reply: m.promptVariableReply },
    summary: {}
  }
  const own: Readonly<Record<string, string>> = all[prompt]
  return Object.entries(own).map(([name, description]) => ({
    name,
    description,
    sample: JSON.stringify(samples[name])
  }))
})
/** The variables as the editor describes them, with their samples. */
const variables = computed(() =>
  Object.fromEntries(
    descriptions.value.map(({ name, description }) => [
      name,
      { description, sample: samples[name] }
    ])
  )
)
</script>

<template>
  <SettingsSection :modified="modified" :data-prompt="prompt" @reset="setting.reset()">
    <template #title>{{ heading }}</template>
    <template #description><slot name="description" /></template>
    <PromptEditor
      ref="editor"
      v-model="text"
      template
      :label="heading"
      :check="check"
      :variables="variables"
      :unknown-variable-message="(name) => ai.promptUnknownVariable({ name })"
    />
    <AppCollapsible
      v-if="descriptions.length > 0"
      v-model:open="variablesOpen"
      :label="ai.promptVariables"
      :ui="{ trigger: 'gap-1 py-1 text-2xs text-muted hover:text-surface', icon: 'size-3' }"
    >
      <!-- Each variable writes itself into the template where the cursor is. -->
      <!-- Names, descriptions, and samples line up in columns across the rows. -->
      <ul class="grid grid-cols-[auto_1fr_auto]">
        <li
          v-for="variable in descriptions"
          :key="variable.name"
          class="col-span-3 grid grid-cols-subgrid"
        >
          <button
            type="button"
            :class="[
              'col-span-3 grid grid-cols-subgrid items-baseline gap-x-2 rounded px-1.5 py-1 text-start hover:bg-hover',
              focusStyles.ring
            ]"
            @click="editor?.insert(`{{ ${variable.name} }}`)"
          >
            <code class="font-mono text-3xs text-surface">{{ variable.name }}</code>
            <span class="min-w-0 text-2xs text-muted">{{ variable.description }}</span>
            <code dir="ltr" class="max-w-48 truncate text-end font-mono text-3xs text-muted">{{
              variable.sample
            }}</code>
          </button>
        </li>
      </ul>
    </AppCollapsible>
    <AppAlert
      v-if="check.errors.length > 0"
      tone="warning"
      :heading="ai.promptErrors"
      :description="errorSummary"
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
