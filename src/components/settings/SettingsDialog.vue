<script setup lang="ts">
import { DialogClose } from 'reka-ui'
import { useTemplateRef } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { settingsDialogOpen, settingsDialogSection } from '@/app/settings/dialog'
import SettingsWorkspace from '@/components/settings/SettingsWorkspace.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import { AppDialogFooter, AppDialogHeader, AppDialogRoot } from '@/components/ui/dialog'

const { settings, common } = useI18n()
const workspace = useTemplateRef('workspace')

function onOpenChange(open: boolean): void {
  if (open) settingsDialogOpen.value = true
  else
    workspace.value?.request(() => {
      settingsDialogOpen.value = false
    })
}
</script>

<template>
  <AppDialogRoot
    :open="settingsDialogOpen"
    size="xl"
    :ui="{ content: 'w-[min(52.5rem,96vw)]' }"
    height="full"
    data-test-id="app-settings-dialog"
    @update:open="onOpenChange"
  >
    <AppDialogHeader
      :heading="settings.title"
      :description="settings.description"
      :close-label="common.close"
    />

    <SettingsWorkspace ref="workspace" v-model:section="settingsDialogSection" answer-navigation />

    <AppDialogFooter v-if="!workspace?.editing">
      <DialogClose as-child>
        <AppButton color="primary" variant="solid" data-test-id="app-settings-done">
          {{ common.done }}
        </AppButton>
      </DialogClose>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
