<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import type { StorageDocument } from '@/app/integrations/storage'
import type { ConflictResolution } from '@/app/storage/conflict'
import {
  AppDialogBody,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'

const { document: document_ } = defineProps<{ document: StorageDocument | null }>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ resolve: [resolution: ConflictResolution] }>()
const { dialogs } = useI18n()

function choose(resolution: ConflictResolution): void {
  open.value = false
  emit('resolve', resolution)
}
</script>

<template>
  <AppDialogRoot v-model:open="open" size="md" data-test-id="storage-conflict-dialog">
    <AppDialogHeader
      :heading="dialogs.syncConflictTitle"
      :description="
        document_ ? dialogs.syncConflictDescription({ name: document_.name }) : undefined
      "
      :close-label="dialogs.close"
    />
    <AppDialogBody>
      <p class="text-[11px] text-muted">{{ dialogs.syncConflictBody }}</p>
    </AppDialogBody>
    <AppDialogFooter>
      <button
        type="button"
        class="mr-auto rounded px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface"
        data-test-id="storage-conflict-later"
        @click="open = false"
      >
        {{ dialogs.syncConflictLater }}
      </button>
      <button
        type="button"
        class="rounded px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface"
        data-test-id="storage-conflict-load-remote"
        @click="choose('load-remote')"
      >
        {{ dialogs.syncConflictLoadRemote }}
      </button>
      <button
        type="button"
        class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
        data-test-id="storage-conflict-keep-copy"
        @click="choose('keep-local-copy')"
      >
        {{ dialogs.syncConflictKeepCopy }}
      </button>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
