<script setup lang="ts">
import { AlertDialogCancel, AlertDialogDescription, AlertDialogTitle } from 'reka-ui'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '@open-pencil/vue'
import { recoveryEnabled } from '@/app/document/recovery/preferences'
import { useNotificationMessages } from '@/app/i18n/notifications'
import { discardRecoverySnapshot, listRecoverySnapshots, restoreRecoverySnapshot } from '@/app/tabs'
import type { RecoverySnapshotMeta } from '@/app/document/recovery'
import { formatStorageBytes } from '@/app/storage/format-bytes'
import { toast } from '@/app/shell/ui'
import AppButton from '@/components/ui/AppButton.vue'

const { recovery, common } = useI18n()
const notifications = useNotificationMessages()
const route = useRoute()
const snapshots = ref<RecoverySnapshotMeta[]>([])
const busyId = ref<string | null>(null)
const open = ref(false)

function updatedLabel(snapshot: RecoverySnapshotMeta): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(snapshot.updatedAt))
}

async function restore(snapshot: RecoverySnapshotMeta): Promise<void> {
  busyId.value = snapshot.id
  try {
    await restoreRecoverySnapshot(snapshot.id)
    snapshots.value = snapshots.value.filter((candidate) => candidate.id !== snapshot.id)
    if (snapshots.value.length === 0) open.value = false
  } catch (error) {
    toast.error(
      notifications.value.operationFailed({
        error: error instanceof Error ? error.message : recovery.value.restoreFailed
      })
    )
  } finally {
    busyId.value = null
  }
}

async function discard(snapshot: RecoverySnapshotMeta): Promise<void> {
  busyId.value = snapshot.id
  try {
    await discardRecoverySnapshot(snapshot.id)
    snapshots.value = snapshots.value.filter((candidate) => candidate.id !== snapshot.id)
    if (snapshots.value.length === 0) open.value = false
  } finally {
    busyId.value = null
  }
}

onMounted(async () => {
  if (route.path !== '/' || !recoveryEnabled.value) return
  try {
    snapshots.value = await listRecoverySnapshots()
    open.value = snapshots.value.length > 0
  } catch (error) {
    console.warn('[Recovery] Failed to list snapshots:', error)
  }
})
</script>

<template>
  <AppAlertDialogRoot v-model:open="open" size="md" data-test-id="recovery-dialog">
    <div class="border-b border-border px-4 py-3">
      <AlertDialogTitle class="text-sm font-semibold text-surface">
        {{ recovery.dialogTitle }}
      </AlertDialogTitle>
    </div>
    <AppDialogBody class="space-y-3">
      <AlertDialogDescription class="text-xs text-muted">
        {{ recovery.dialogDescription }}
      </AlertDialogDescription>
      <div class="max-h-72 space-y-2 overflow-y-auto">
        <div
          v-for="snapshot in snapshots"
          :key="snapshot.id"
          class="flex items-center gap-3 rounded border border-border p-3"
        >
          <icon-lucide-file-clock class="size-4 shrink-0 text-muted" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-medium text-surface">{{ snapshot.documentName }}</p>
            <p class="text-[11px] text-muted">
              {{ updatedLabel(snapshot) }} · {{ formatStorageBytes(snapshot.byteLength) }}
            </p>
          </div>
          <AppButton
            color="error"
            variant="ghost"
            size="xs"
            :disabled="busyId !== null"
            @click="discard(snapshot)"
          >
            {{ recovery.discard }}
          </AppButton>
          <AppButton
            color="primary"
            variant="solid"
            size="xs"
            :disabled="busyId !== null"
            @click="restore(snapshot)"
          >
            {{ recovery.restore }}
          </AppButton>
        </div>
      </div>
    </AppDialogBody>
    <AppDialogFooter>
      <AlertDialogCancel as-child>
        <AppButton color="neutral" variant="ghost">{{ common.close }}</AppButton>
      </AlertDialogCancel>
    </AppDialogFooter>
  </AppAlertDialogRoot>
</template>
