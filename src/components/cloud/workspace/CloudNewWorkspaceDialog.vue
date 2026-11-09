<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCloudMessages, useCommonMessages } from '@open-pencil/vue/i18n'

import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

/** Naming a new workspace on a Cloud server; the person who creates it administers it. */
const { busy = false, failed = false } = defineProps<{ busy?: boolean; failed?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ create: [name: string]; cancel: [] }>()

const t = useCloudMessages()
const common = useCommonMessages()
const name = ref('')
const trimmed = computed(() => name.value.trim())
</script>

<template>
  <AppFormDialog
    v-model:open="open"
    :heading="t.newWorkspaceHeading"
    :description="t.newWorkspaceDescription"
    :close-label="common.close"
    :cancel-label="common.cancel"
    :submit-label="t.createWorkspace"
    :error="failed ? t.workspaceFailed : null"
    :saving="busy"
    :submit-disabled="!trimmed"
    @open="name = ''"
    @cancel="emit('cancel')"
    @submit="trimmed && emit('create', trimmed)"
  >
    <AppFormField :label="t.workspaceName">
      <template #default="{ id }">
        <AppInput
          :id="id"
          v-model="name"
          autofocus
          maxlength="100"
          :disabled="busy"
          :placeholder="t.workspaceNamePlaceholder"
        />
      </template>
    </AppFormField>
  </AppFormDialog>
</template>
