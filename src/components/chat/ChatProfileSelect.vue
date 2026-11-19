<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import AppSelect from '@/components/ui/select/AppSelect.vue'

import { useDesignProfiles } from './input/useDesignProfiles'
import { chatProfileTheme } from './ui'

const { ai } = useI18n()
const ui = chatProfileTheme()
const selectUI = { content: ui.content(), item: ui.item() }

const { profiles, selectedProfileId, profileOf, manageModels: openModels } = useDesignProfiles()
const groups = computed(() => [{ label: ai.value.modelRoleDesign, options: profiles.value }])

function manageModels(close: () => void): void {
  close()
  openModels()
}
</script>

<template>
  <AppSelect
    v-model="selectedProfileId"
    :label="ai.selectDesignModel"
    :groups="groups"
    :ui="selectUI"
    data-test-id="chat-profile-selector"
  >
    <template #trigger>
      <button type="button" :class="ui.trigger({ class: 'flex items-center' })">
        <icon-lucide-bot :class="ui.triggerIcon()" />
        <span :class="ui.triggerValue()"><slot name="value" /></span>
        <icon-lucide-chevron-down :class="ui.triggerChevron()" aria-hidden="true" />
      </button>
    </template>
    <template #option="{ option }">
      <span :class="ui.text()">
        <span :class="ui.name()">{{ option.label }}</span>
        <span :class="ui.metadata()">{{ profileOf(option.value)?.metadata }}</span>
      </span>
    </template>
    <template #option-end="{ option }">
      <icon-lucide-eye
        v-if="profileOf(option.value)?.takesImages"
        :class="ui.capability()"
        :aria-label="ai.modelCapabilityVision"
      />
    </template>
    <template #footer="{ close }">
      <button type="button" :class="ui.footer()" @click="manageModels(close)">
        <span :class="ui.footerIcon()"><icon-lucide-settings class="size-3" /></span>
        {{ ai.manageModelsAndRoles }}
      </button>
    </template>
  </AppSelect>
</template>
