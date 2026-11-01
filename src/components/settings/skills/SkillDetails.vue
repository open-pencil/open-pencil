<script setup lang="ts">
import { computed } from 'vue'

import { useAIMessages, useCommonMessages } from '@open-pencil/vue/i18n'

import type { SelectedSkill } from '@/app/ai/skills/settings/use'
import MarkdownContent from '@/components/markdown/MarkdownContent.vue'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

import { useSkillMessages } from './messages'

const { entry } = defineProps<{ entry: SelectedSkill }>()

const emit = defineEmits<{ done: []; remove: []; 'set-enabled': [enabled: boolean] }>()

const ai = useAIMessages()
const common = useCommonMessages()
const messages = useSkillMessages()

const skill = computed(() => entry.skill)
const uploaded = computed(() => skill.value.source === 'openpencil')
const useDescription = computed(() => {
  if (entry.untrusted) return ai.value.skillsFolderUntrusted
  if (!entry.sourceEnabled) return ai.value.skillsSourceOff
  if (entry.shadowed) return ai.value.skillsShadowed
  return ai.value.skillsUseDescription
})
</script>

<template>
  <SettingsPage data-test-id="settings-skill-details">
    <div class="flex flex-col gap-6">
      <SettingsSection>
        <template #title>{{ skill.name }}</template>
        <template #description>{{ skill.description }}</template>
        <SettingsGroup>
          <SettingsRow as="label" :label="ai.skillsUse" :description="useDescription">
            <AppSwitch
              :model-value="entry.enabled"
              :label="ai.skillsUse"
              :disabled="!entry.sourceEnabled"
              @update:model-value="emit('set-enabled', $event)"
            />
          </SettingsRow>
          <SettingsRow v-if="!uploaded" :label="ai.skillsLocation">
            <code class="text-[11px] break-all text-muted">{{ skill.location }}</code>
          </SettingsRow>
          <SettingsRow v-if="skill.files.length" :label="ai.skillsFiles">
            <template #description>
              <ul class="mt-1 flex flex-col gap-0.5">
                <li v-for="file in skill.files" :key="file">
                  <code class="text-[11px] break-all text-muted">{{ file }}</code>
                </li>
              </ul>
            </template>
          </SettingsRow>
        </SettingsGroup>
        <AppAlert v-if="skill.warnings.length" tone="warning" :heading="ai.skillsWarnings">
          <ul class="flex flex-col gap-0.5">
            <li v-for="warning in skill.warnings" :key="warning">
              {{ messages.warning(warning) }}
            </li>
          </ul>
        </AppAlert>
      </SettingsSection>
      <SettingsSection>
        <template #title>{{ ai.skillsInstructions }}</template>
        <div class="rounded border border-border px-4 py-3">
          <MarkdownContent :content="skill.instructions" />
        </div>
      </SettingsSection>
    </div>
    <template #footer>
      <AppButton
        v-if="uploaded"
        class="mr-auto"
        color="error"
        variant="link"
        @click="emit('remove')"
        >{{ ai.skillsDelete }}</AppButton
      >
      <AppButton color="primary" variant="solid" @click="emit('done')">{{ common.done }}</AppButton>
    </template>
  </SettingsPage>
</template>
