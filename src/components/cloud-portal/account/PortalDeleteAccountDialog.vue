<script setup lang="ts">
import { computed, ref } from 'vue'

import type { CloudAccountDeletion } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import type { PortalAccountArchive } from '@/components/cloud-portal/types'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppConfirmTextField from '@/components/ui/dialog/AppConfirmTextField.vue'
import AppDialogCancel from '@/components/ui/dialog/AppDialogCancel.vue'
import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

/**
 * Deleting the account: what goes, the workspaces that stop it until someone else is their admin,
 * Download all for the files it would take, and the email typed out to confirm.
 */
const {
  email,
  deletion,
  loadError = null,
  archive = null,
  error = null,
  deleting = false
} = defineProps<{
  email: string
  /** What deleting would take; null while it loads. */
  deletion: CloudAccountDeletion | null
  loadError?: string | null
  archive?: PortalAccountArchive | null
  error?: string | null
  deleting?: boolean
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ downloadAll: []; confirm: [] }>()

const messages = useCloudPortalMessages()
const confirmed = ref(false)

const blocked = computed(
  () => Boolean(deletion?.lastAdministrator) || (deletion?.blockedBy.length ?? 0) > 0
)
const downloading = computed(() => archive !== null && archive.saved === null)
</script>

<template>
  <AppFormDialog
    v-model:open="open"
    :heading="messages.deleteAccountHeading"
    :description="messages.deleteAccountIntro"
    :error="error"
    :error-heading="messages.errorTitle"
    @submit="emit('confirm')"
  >
    <AppAlert
      v-if="loadError"
      tone="error"
      :heading="messages.errorTitle"
      :description="loadError"
    />
    <p v-else-if="!deletion" class="text-xs text-muted">{{ messages.loading }}</p>
    <template v-else>
      <AppAlert
        v-if="deletion.lastAdministrator"
        tone="warning"
        :heading="messages.deleteAccountLastAdminHeading"
        :description="messages.deleteAccountLastAdminDescription"
      />
      <AppAlert
        v-if="deletion.blockedBy.length > 0"
        tone="warning"
        :heading="messages.deleteAccountBlockedHeading"
        :description="messages.deleteAccountBlockedDescription"
      >
        <template #details>
          <ul class="list-disc pl-4">
            <li v-for="workspace in deletion.blockedBy" :key="workspace.id">
              {{ workspace.name }}
            </li>
          </ul>
        </template>
      </AppAlert>
      <ul class="flex list-disc flex-col gap-1 pl-4 text-xs text-surface">
        <li v-if="deletion.deletes.length > 0">
          {{ messages.deleteAccountWorkspaces(deletion.deletes.length) }}:
          {{ deletion.deletes.map((workspace) => workspace.name).join(', ') }}
        </li>
        <li v-if="deletion.leaves.length > 0">
          {{ messages.deleteAccountLeaves }}:
          {{ deletion.leaves.map((workspace) => workspace.name).join(', ') }}
        </li>
        <li>{{ messages.deleteAccountSignIn }}</li>
      </ul>

      <div class="flex items-start justify-between gap-3 rounded border border-border p-3">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-surface">{{ messages.deleteAccountDownload }}</p>
          <p class="mt-0.5 text-2xs text-muted" aria-live="polite">
            <template v-if="downloading && archive">
              {{ messages.downloadProgress({ done: archive.done, total: archive.total }) }}
            </template>
            <template v-else-if="archive && archive.saved !== null">
              {{ messages.downloadSaved(archive.saved) }}
            </template>
            <template v-else-if="deletion.documents.length > 0">
              {{ messages.deleteAccountDownloadDescription(deletion.documents.length) }}
            </template>
            <template v-else>{{ messages.deleteAccountNothingToDownload }}</template>
          </p>
          <p v-if="archive && archive.failed.length > 0" class="mt-0.5 text-2xs text-error">
            {{ messages.downloadFailed({ names: archive.failed.join(', ') }) }}
          </p>
        </div>
        <AppButton
          v-if="deletion.documents.length > 0"
          size="sm"
          variant="outline"
          :loading="downloading"
          :disabled="deleting"
          @click="emit('downloadAll')"
        >
          {{ messages.downloadAll }}
        </AppButton>
      </div>

      <!-- Starts empty each opening: the opener clears `deletion`, which remounts it. -->
      <AppConfirmTextField v-if="!blocked" v-model:matched="confirmed" :expected="email" />
    </template>
    <template #footer>
      <AppDialogCancel />
      <AppButton
        type="submit"
        color="error"
        variant="solid"
        :loading="deleting"
        :disabled="!deletion || blocked || !confirmed || downloading"
      >
        {{ messages.deleteAccountConfirm }}
      </AppButton>
    </template>
  </AppFormDialog>
</template>
