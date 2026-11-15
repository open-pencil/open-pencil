<script setup lang="ts">
import { useTemplateRef } from 'vue'

import type { CloudAdminDocumentFilter } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages, useI18n } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import type { PortalListRequest } from '@/app/cloud-portal/list'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalDocuments from '../console/PortalDocuments.vue'
import type { PortalContentAction, PortalDocumentRow } from '../types'
import { documentRow, useContentActions } from './content'

const emit = defineEmits<{ changed: [] }>()
const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()
const list = useTemplateRef('list')

async function load(request: PortalListRequest<CloudAdminDocumentFilter>) {
  const { documents, total, counts } = await portal.api.documents(request)
  return { rows: documents.map((document) => documentRow(document, locale.value)), total, counts }
}

const {
  subject: busy,
  error,
  run
} = useContentActions(
  () => list.value?.reload(),
  () => emit('changed')
)
function act(action: PortalContentAction, document: PortalDocumentRow, reason?: string) {
  void run(document.id, action, { document }, reason)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <PortalDocuments ref="list" :load="load" :busy="busy" @act="act" />
  </div>
</template>
