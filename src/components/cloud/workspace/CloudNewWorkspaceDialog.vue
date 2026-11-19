<script setup lang="ts">
import { computed } from 'vue'

import { useCloudMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogCancel from '@/components/ui/dialog/AppDialogCancel.vue'
import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

/**
 * Naming a new workspace on a Cloud server; the person who creates it administers it. The name is
 * the opener's, which starts it empty.
 */
const { busy = false, failed = false } = defineProps<{ busy?: boolean; failed?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const name = defineModel<string>('name', { default: '' })
const emit = defineEmits<{ create: [name: string] }>()

const t = useCloudMessages()
const trimmed = computed(() => name.value.trim())
</script>

<template>
  <AppFormDialog
    v-model:open="open"
    :heading="t.newWorkspaceHeading"
    :description="t.newWorkspaceDescription"
    :error="failed ? t.workspaceFailed : null"
    @submit="emit('create', trimmed)"
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
    <template #footer>
      <AppDialogCancel />
      <AppButton type="submit" color="primary" variant="solid" :loading="busy" :disabled="!trimmed">
        {{ t.createWorkspace }}
      </AppButton>
    </template>
  </AppFormDialog>
</template>
