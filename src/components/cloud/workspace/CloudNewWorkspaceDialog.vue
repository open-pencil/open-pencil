<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useCloudMessages, useCommonMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

import { cloudWorkspace } from './ui'

/** Naming a new workspace on a Cloud server; the person who creates it administers it. */
const { busy = false, failed = false } = defineProps<{ busy?: boolean; failed?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ create: [name: string]; cancel: [] }>()

const ui = cloudWorkspace()
const t = useCloudMessages()
const common = useCommonMessages()
const name = ref('')
const trimmed = computed(() => name.value.trim())
watch(open, (isOpen) => {
  if (isOpen) name.value = ''
})
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader
      :heading="t.newWorkspaceHeading"
      :description="t.newWorkspaceDescription"
      :close-label="common.close"
    />
    <AppDialogBody>
      <form
        id="cloud-new-workspace"
        :class="ui.form()"
        novalidate
        @submit.prevent="trimmed && emit('create', trimmed)"
      >
        <label for="cloud-new-workspace-name" :class="ui.label()">{{ t.workspaceName }}</label>
        <AppInput
          id="cloud-new-workspace-name"
          v-model="name"
          autofocus
          maxlength="100"
          :disabled="busy"
          :placeholder="t.workspaceNamePlaceholder"
        />
        <AppAlert v-if="failed" tone="error" :heading="t.workspaceFailed" />
      </form>
    </AppDialogBody>
    <AppDialogFooter :ui="{ footer: 'justify-between' }">
      <AppButton @click="emit('cancel')">{{ common.cancel }}</AppButton>
      <AppButton
        type="submit"
        form="cloud-new-workspace"
        color="primary"
        variant="solid"
        :loading="busy"
        :disabled="!trimmed"
      >
        {{ t.createWorkspace }}
      </AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
