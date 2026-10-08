<script setup lang="ts">
import { ref } from 'vue'

import { useCollaborationMessages } from '@open-pencil/vue'

import { useCollabIdentity } from '@/app/collab/identity'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

/** The one name others see in every shared room; while empty, rooms use a generated one. */
const messages = useCollaborationMessages()
const identity = useCollabIdentity()
const draft = ref(identity.hasChosenName.value ? identity.name.value : '')

function save() {
  identity.setName(draft.value)
}
</script>

<template>
  <SettingsSection>
    <template #title>{{ messages.nameSettingTitle }}</template>
    <template #description>{{ messages.nameSettingDescription }}</template>
    <SettingsGroup>
      <div class="px-3 py-2.5">
        <AppInput
          v-model="draft"
          data-test-id="settings-collab-name"
          class="w-full sm:w-72"
          :aria-label="messages.nameSettingTitle"
          :placeholder="messages.enterYourName"
          @change="save"
          @enter="save"
        />
      </div>
    </SettingsGroup>
  </SettingsSection>
</template>
