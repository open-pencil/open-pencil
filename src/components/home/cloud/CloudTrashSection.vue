<script setup lang="ts">
import { useAsyncState, useNow } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'

import type { TrashedDocument } from '@open-pencil/cloud/contract'
import { useCloudMessages, useI18n } from '@open-pencil/vue/i18n'

import { findCloudServer } from '@/app/cloud/servers/store'
import { cloudAPIClient, cloudConnection } from '@/app/cloud/sessions/connection'
import { useDateFormat } from '@/app/i18n/date'
import { toast } from '@/app/shell/ui'
import { AppConfirmationDialog } from '@/components/ui/dialog'

import CloudTrashView from './CloudTrashView.vue'
import type { CloudTrashRow } from './types'

const DAY_MS = 24 * 60 * 60_000

/** Trash of the server Home shows: what the person may restore, across their workspaces. */
const { serverId, query = '' } = defineProps<{
  serverId: string
  /** Home's search, already lowercased in the app's locale. */
  query?: string
}>()

const { locale } = useI18n()
const t = useCloudMessages()
const dates = useDateFormat()
const now = useNow({ interval: 60_000 })

function client() {
  const server = findCloudServer(serverId)
  const discovery = cloudConnection(serverId).discovery
  return server && discovery ? cloudAPIClient(server, discovery) : null
}

const {
  state: documents,
  isLoading,
  error,
  execute: refresh
} = useAsyncState(
  async (): Promise<TrashedDocument[]> => (await client()?.listTrash()) ?? [],
  [],
  // Keep the last list on screen while it reloads.
  { resetOnExecute: false }
)
// Home's server can change under this list; another server's Trash never stays listed.
watch(
  () => serverId,
  () => {
    documents.value = []
    void refresh()
  }
)
const state = computed(() => {
  if (isLoading.value && documents.value.length === 0) return 'loading'
  return error.value ? 'error' : 'ready'
})

const rows = computed<CloudTrashRow[]>(() =>
  documents.value.map((document) => {
    const when = dates.relative(document.deletedAt)
    return {
      id: document.id,
      name: document.name,
      kind: document.kind,
      metadata: document.deletedBy
        ? t.value.homeTrashDeletedBy({
            workspace: document.workspaceName,
            when,
            name: document.deletedBy.name
          })
        : t.value.homeTrashDeleted({ workspace: document.workspaceName, when }),
      daysLeft: Math.max(
        1,
        Math.ceil((Date.parse(document.purgeAt) - now.value.getTime()) / DAY_MS)
      ),
      canPurge: document.canPurge
    }
  })
)
const matching = computed(() =>
  query
    ? rows.value.filter((row) => row.name.toLocaleLowerCase(locale.value).includes(query))
    : rows.value
)

const busy = ref<string | null>(null)

function find(row: CloudTrashRow) {
  return documents.value.find((document) => document.id === row.id)
}

/** Runs an action on one document, then lists Trash again, whether the action worked or not. */
async function act(id: string, action: () => Promise<void>, failed: string) {
  busy.value = id
  try {
    await action()
  } catch (cause: unknown) {
    console.error('[Cloud] A Trash action failed:', cause)
    toast.error(failed)
  } finally {
    busy.value = null
    await refresh()
  }
}

function restore(row: CloudTrashRow) {
  const document = find(row)
  const api = client()
  if (!document || !api) return
  void act(
    document.id,
    async () => {
      await api.restoreDocument(document.id)
      toast.info(
        t.value.homeTrashRestored({ name: document.name, workspace: document.workspaceName })
      )
    },
    t.value.homeTrashRestoreFailed({ name: document.name })
  )
}

// The dialog keeps its heading while it animates closed, so it holds the document apart.
const confirming = ref(false)
const purging = shallowRef<TrashedDocument | null>(null)

function askToPurge(row: CloudTrashRow) {
  const document = find(row)
  if (!document) return
  purging.value = document
  confirming.value = true
}

function purge() {
  const document = purging.value
  const api = client()
  if (!document || !api) return
  void act(
    document.id,
    () => api.purgeDocument(document.id),
    t.value.homeTrashDeleteForeverFailed({ name: document.name })
  )
}
</script>

<template>
  <CloudTrashView
    :documents="matching"
    :state="state"
    :busy="busy"
    @restore="restore"
    @purge="askToPurge"
    @refresh="refresh"
  />
  <AppConfirmationDialog
    v-model:open="confirming"
    :heading="t.homeTrashDeleteForeverHeading({ name: purging?.name ?? '' })"
    :description="t.homeTrashDeleteForeverDescription"
    :confirm-label="t.homeTrashDeleteForever"
    tone="danger"
    @confirm="purge"
  />
</template>
