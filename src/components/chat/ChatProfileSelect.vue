<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectLabel,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'

import { AI_PROVIDERS } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue'

import {
  aiModelSettings,
  designModelProfiles,
  modelConnection,
  setModelRoleAssignment
} from '@/app/ai/models'
import type { AIModelProfile, AIModelProfileId } from '@/app/ai/models'
import { openSettingsDialog } from '@/app/settings/dialog'
import ChatProfileItem from '@/components/chat/ChatProfileItem.vue'
import { useSelectUI } from '@/components/ui/select'
import { chatProfileTheme } from '@/theme/chat/profile'

const { ai } = useI18n()
const open = ref(false)
const profiles = computed(designModelProfiles)
const ui = chatProfileTheme()
const selectCls = useSelectUI({
  trigger: ui.trigger(),
  content: ui.content(),
  viewport: ui.viewport(),
  item: ui.item(),
  contentVariants: { padding: 'none' }
})

const selectedProfileId = computed({
  get: () => aiModelSettings.value.assignments.design,
  set: (profileId: AIModelProfileId) => setModelRoleAssignment('design', profileId)
})

function profileMetadata(profile: AIModelProfile): string {
  const connection = modelConnection(profile.connectionId)
  const provider = AI_PROVIDERS.find((candidate) => candidate.id === connection?.providerID)
  const modelID = profile.customModelID || profile.modelID
  const modelName = provider?.models.find((model) => model.id === modelID)?.name || modelID
  return [modelName, provider?.name ?? connection?.providerID].filter(Boolean).join(' · ')
}

function manageModels(): void {
  open.value = false
  openSettingsDialog('ai')
}
</script>

<template>
  <SelectRoot v-model="selectedProfileId" v-model:open="open">
    <SelectTrigger
      data-test-id="chat-profile-selector"
      :aria-label="ai.selectDesignModel"
      :class="selectCls.trigger"
    >
      <icon-lucide-bot :class="ui.triggerIcon()" />
      <span :class="ui.triggerValue()"><slot name="value" /></span>
      <icon-lucide-chevron-down :class="ui.triggerChevron()" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        side="top"
        align="start"
        :side-offset="4"
        :collision-padding="8"
        :class="selectCls.content"
      >
        <SelectViewport :class="selectCls.viewport">
          <SelectGroup>
            <div :class="ui.header()">
              <SelectLabel :class="ui.headerLabel()">{{ ai.modelRoleDesign }}</SelectLabel>
              <p :class="ui.headerDescription()">{{ ai.modelRoleDesignDescription }}</p>
            </div>
            <SelectItem
              v-for="profile in profiles"
              :key="profile.id"
              :value="profile.id"
              :text-value="`${profile.name} ${profileMetadata(profile)}`"
              :class="selectCls.item"
            >
              <SelectItemIndicator :class="ui.indicator()">
                <icon-lucide-check :class="ui.indicatorIcon()" />
              </SelectItemIndicator>
              <span v-if="profile.id !== selectedProfileId" :class="ui.indicator()" />
              <SelectItemText as-child>
                <ChatProfileItem :profile="profile" :metadata="profileMetadata(profile)" />
              </SelectItemText>
            </SelectItem>
          </SelectGroup>
          <button type="button" :class="ui.footer()" @click="manageModels">
            <icon-lucide-settings :class="ui.footerIcon()" />
            {{ ai.manageModelsAndRoles }}
          </button>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
