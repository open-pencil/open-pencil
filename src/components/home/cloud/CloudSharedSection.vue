<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { computed, onMounted, ref, shallowRef } from 'vue'

import type { SharedDocument } from '@open-pencil/cloud/contract'
import { useCloudMessages, useI18n } from '@open-pencil/vue'

import { findCloudServer } from '@/app/cloud/servers/store'
import { cloudAPIClient, cloudConnection } from '@/app/cloud/sessions/connection'
import { CLOUD_STORAGE_PROVIDER_ID } from '@/app/cloud/sessions/token'
import { formatCommentTime, useCommentClock } from '@/app/comments/time'
import { openStorageDocumentInNewTab } from '@/app/tabs'

import CloudWorkspaceView from './CloudWorkspaceView.vue'
import type { CloudDocumentRow } from './types'

/** Documents people on the server Home shows shared with this account directly. */
const { serverId, query = '' } = defineProps<{
  serverId: string
  /** Home's search, already lowercased in the app's locale. */
  query?: string
}>()

const { locale } = useI18n()
const t = useCloudMessages()
const now = useCommentClock()
const view = useLocalStorage<'grid' | 'list'>('open-pencil:home-files-view', 'grid')
const documents = shallowRef<SharedDocument[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')

async function refresh() {
  const server = findCloudServer(serverId)
  const discovery = cloudConnection(serverId).discovery
  if (!server || !discovery) return
  state.value = 'loading'
  try {
    documents.value = await cloudAPIClient(server, discovery).listSharedDocuments()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}

onMounted(refresh)

const rows = computed<CloudDocumentRow[]>(() =>
  documents.value.map((document) => ({
    id: document.id,
    name: document.name,
    editedAt: formatCommentTime(document.updatedAt, now.value.getTime(), locale.value),
    editedBy: document.sharedBy
      ? t.value.homeSharedBy({ name: document.sharedBy.name })
      : undefined,
    sync: 'synced',
    permission: document.permission
  }))
)

const matching = computed(() =>
  query
    ? rows.value.filter((row) => row.name.toLocaleLowerCase(locale.value).includes(query))
    : rows.value
)

function open(row: CloudDocumentRow) {
  const document = documents.value.find((candidate) => candidate.id === row.id)
  if (!document) return
  // A shared document stays in its owner's workspace; the direct grant is what opens it.
  void openStorageDocumentInNewTab(
    {
      id: document.id,
      name: document.name,
      updatedAt: document.updatedAt,
      revision: document.currentRevisionId
    },
    {
      providerId: CLOUD_STORAGE_PROVIDER_ID,
      profileId: serverId,
      containerId: document.workspaceId
    }
  )
}
</script>

<template>
  <CloudWorkspaceView
    v-model:view="view"
    :heading="t.homeSharedWithYou"
    :subtitle="t.homeSharedSubtitle"
    :documents="matching"
    :state="state"
    @open="open"
    @refresh="refresh"
  />
</template>
