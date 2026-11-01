<script setup lang="ts">
import { useWindowFocus, watchImmediate } from '@vueuse/core'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { useDateFormat } from '@/app/i18n/date'
import { useNotificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import { formatStorageBytes } from '@/app/storage/format-bytes'
import { allTabs } from '@/app/tabs'
import {
  discardRecoverable,
  recoverable,
  refreshRecoverableSnapshots,
  restoreRecoverable,
  type RecoverableSnapshot
} from '@/app/tabs/recovery'
import DocumentEntry from '@/components/home/document/DocumentEntry.vue'

/** Recovery copies of documents closed without saving, until each is restored or discarded. */
const { view, query } = defineProps<{ view: 'grid' | 'list'; query: string }>()
const { recovery, files, locale } = useI18n()
const notifications = useNotificationMessages()
const dates = useDateFormat()
const focused = useWindowFocus()

const snapshots = computed(() =>
  recoverable.value.filter((snapshot) =>
    snapshot.documentName.toLocaleLowerCase(locale.value).includes(query)
  )
)

// A closed tab or another window that went away can leave a copy behind.
watchImmediate([() => allTabs.value.length, focused], () => {
  void refreshRecoverableSnapshots().catch((error: unknown) => {
    console.warn('[Recovery] Failed to list snapshots:', error)
  })
})

function metadata(snapshot: RecoverableSnapshot): string {
  return `${dates.format(snapshot.updatedAt, 'dateTime')} · ${formatStorageBytes(snapshot.byteLength)}`
}

function menu(snapshot: RecoverableSnapshot) {
  return {
    actions: files.value.documentActions({ name: snapshot.documentName }),
    delete: recovery.value.discard
  }
}

async function restore(snapshot: RecoverableSnapshot): Promise<void> {
  try {
    await restoreRecoverable(snapshot.id)
  } catch (error) {
    toast.error(
      notifications.value.operationFailed({
        error: error instanceof Error ? error.message : recovery.value.restoreFailed
      })
    )
  }
}

function discard(snapshot: RecoverableSnapshot): void {
  void discardRecoverable(snapshot.id).catch((error: unknown) => {
    console.warn('[Recovery] Failed to discard a snapshot:', error)
  })
}
</script>

<template>
  <section v-if="snapshots.length" class="mb-8" data-test-id="home-recovery">
    <div class="mb-3 min-w-0">
      <h2 class="text-base font-semibold">{{ recovery.sectionTitle }}</h2>
      <p class="mt-0.5 text-pretty text-xs text-muted">{{ recovery.sectionDescription }}</p>
    </div>
    <div
      :class="
        view === 'grid'
          ? 'grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]'
          : 'overflow-hidden rounded-lg border border-border'
      "
    >
      <DocumentEntry
        v-for="snapshot in snapshots"
        :key="snapshot.id"
        :view="view"
        :name="snapshot.documentName"
        :metadata="metadata(snapshot)"
        :menu="menu(snapshot)"
        @open="restore(snapshot)"
        @delete="discard(snapshot)"
      />
    </div>
  </section>
</template>
